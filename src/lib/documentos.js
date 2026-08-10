/**
 * Documentos gerados (contratos) guardados para consulta futura.
 *
 * O PDF vive em data/documentos/<ano>/<uuid>.pdf — fora de public/, mesmo
 * padrão de data/vehicle-docs/. Server-only.
 */
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { query } from "@/lib/db";
import { papelPorTemplate } from "@/lib/clientes/prefill";
import { ligarVeiculo } from "@/lib/clientes/repo";

const DOCS_ROOT = path.join(process.cwd(), "data", "documentos");
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB — um contrato em PDF vetorial tem poucos KB
const TIPOS = ["compra-venda", "venda", "consignacao", "termo-vistoria"];

export async function salvarDocumento({ tipo, titulo, cliente, clienteId, vehicleId, criadoPor, buffer }) {
  if (!TIPOS.includes(tipo)) return { error: "Tipo de documento desconhecido." };
  if (!titulo) return { error: "Documento sem título." };
  if (!buffer?.length) return { error: "Arquivo vazio." };
  if (buffer.length > MAX_BYTES) return { error: "Arquivo acima de 20 MB." };

  const ano = String(new Date().getFullYear());
  const relativo = path.join(ano, `${uuidv4()}.pdf`);
  await fs.mkdir(path.join(DOCS_ROOT, ano), { recursive: true });
  await fs.writeFile(path.join(DOCS_ROOT, relativo), buffer);

  let rows;
  try {
    ({ rows } = await query(
      `insert into documentos_gerados (tipo, titulo, cliente, cliente_id, vehicle_id, arquivo, tamanho, criado_por)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [tipo, titulo, cliente || null, clienteId || null, vehicleId || null, relativo, buffer.length, criadoPor || null]
    ));
  } catch (err) {
    // insert falhou (vehicleId inválido, banco fora do ar etc.) — sem a linha
    // no banco o arquivo fica órfão e inalcançável, então apaga antes de propagar.
    // catch vazio no unlink é proposital: falha ao limpar não pode esconder o erro original.
    await fs.unlink(path.join(DOCS_ROOT, relativo)).catch(() => {});
    throw err;
  }

  const papel = papelPorTemplate(tipo);
  if (clienteId && vehicleId && papel) {
    // O vínculo é um efeito colateral desejável, não a razão de existir do
    // contrato: falhar aqui não pode desfazer um documento já gravado.
    try {
      const { vinculo } = await ligarVeiculo({
        clienteId, vehicleId, papel, origem: "contrato", documentoId: rows[0].id,
      });
      // Item 5 da revisão 2 (fix-revisao2-report.md): a venda pelo CRM pode
      // ter criado este mesmo vínculo (cliente_id, vehicle_id, papel) ANTES
      // do contrato — `on conflict do nothing` em ligarVeiculo() faz o
      // insert acima não fazer nada, e o `vinculo` devolvido é a linha que
      // já existia, com `documento_id` nulo. Sem isto, esse vínculo ficava
      // para sempre sem apontar para o contrato que o gerou. `coalesce`
      // preserva um `documento_id` que já estivesse preenchido (contrato
      // sempre escreveu primeiro, é o caso comum) — só completa o que
      // estava faltando.
      if (vinculo && !vinculo.documento_id) {
        await query(
          `update cliente_veiculos set documento_id = coalesce(documento_id, $2) where id = $1`,
          [vinculo.id, rows[0].id]
        );
      }
    } catch (err) {
      console.error("Contrato gravado, mas o vínculo cliente-veículo falhou:", err);
    }
  }

  return { documento: rows[0] };
}

// Escapa os curingas do LIKE (% e _) e o próprio escape (\) antes de montar o
// padrão — sem isso, buscar por "%" ou "_" lista tudo em vez de nada.
function escapeCuringasLike(str) {
  return str.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const SELECT = `
  select d.*, v.brand, v.model, v.year, v.ano_modelo, v.placa, u.name as criado_por_nome
    from documentos_gerados d
    left join vehicles v on v.id = d.vehicle_id
    left join users u on u.id = d.criado_por
`;

export async function listDocumentos({ busca } = {}) {
  const termo = String(busca || "").trim();
  const { rows } = termo
    ? await query(
        `${SELECT} where lower(d.cliente) like lower($1) or lower(coalesce(v.placa,'')) like lower($1)
         order by d.created_at desc`,
        [`%${escapeCuringasLike(termo)}%`]
      )
    : await query(`${SELECT} order by d.created_at desc`);
  return rows;
}

export async function listDocumentosDoVeiculo(vehicleId) {
  const { rows } = await query(
    `${SELECT} where d.vehicle_id = $1 order by d.created_at desc`,
    [vehicleId]
  );
  return rows;
}

// O `arquivo` sempre é gerado pelo servidor no formato <ano>/<uuid>.pdf (ver
// salvarDocumento). Hoje não há como essa coluna vir de outra fonte, mas
// blindar aqui evita que um path.join com valor fora desse formato algum dia
// escape de DOCS_ROOT (path traversal) — não é paranoia, é não depender para
// sempre da invariante de quem escreve na tabela.
const ARQUIVO_VALIDO = /^\d{4}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i;

/** Caminho absoluto do PDF, ou null se a linha ou o arquivo não existirem. */
export async function getDocumentoArquivo(id) {
  const { rows } = await query(
    `select titulo, arquivo from documentos_gerados where id = $1`,
    [id]
  );
  if (!rows.length) return null;
  if (!ARQUIVO_VALIDO.test(rows[0].arquivo)) return null;
  const caminhoAbsoluto = path.join(DOCS_ROOT, rows[0].arquivo);
  try {
    await fs.access(caminhoAbsoluto);
  } catch {
    return null; // linha no banco, arquivo sumiu do disco
  }
  return { caminhoAbsoluto, titulo: rows[0].titulo };
}
