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

export async function salvarDocumento({
  tipo, titulo, cliente, clienteId, vehicleId, criadoPor, buffer,
  dados, corrigeDocumentoId,
}) {
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
      `insert into documentos_gerados
         (tipo, titulo, cliente, cliente_id, vehicle_id, arquivo, tamanho, criado_por,
          dados, corrige_documento_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) returning *`,
      [
        tipo, titulo, cliente || null, clienteId || null, vehicleId || null, relativo,
        buffer.length, criadoPor || null,
        // Os campos digitados, para o contrato poder ser corrigido sem
        // redigitar. Sem eles, trocar uma linha custa preencher tudo de novo.
        dados ? JSON.stringify(dados) : null,
        corrigeDocumentoId || null,
      ]
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

// A assinatura entra por lateral e não por join simples porque um documento
// pode ter vários envios (recusado, expirado, reenviado) e a lista só quer o
// que está valendo: o envio vivo, ou o último de todos quando nenhum está.
// Um join comum multiplicaria a linha do contrato por tentativa.
// `d.*` NÃO entra aqui de propósito: a coluna `dados` guarda CPF, CNH e
// endereço das partes, e a listagem vai inteira para o navegador de quem abrir
// a tela. Só o formulário de correção precisa desses campos, e ele os busca um
// a um por getDocumentoDados(). `tem_dados` diz se dá para corrigir sem
// carregar nada de pessoal.
const SELECT = `
  select d.id, d.tipo, d.titulo, d.cliente, d.cliente_id, d.vehicle_id, d.arquivo,
         d.tamanho, d.criado_por, d.created_at, d.corrige_documento_id,
         d.dados is not null as tem_dados,
         v.brand, v.model, v.year, v.ano_modelo, v.placa, u.name as criado_por_nome,
         a.status as assinatura_status,
         a.arquivo_assinado is not null as tem_via_assinada,
         a.signers as assinatura_signers,
         c.email as cliente_email
    from documentos_gerados d
    left join vehicles v on v.id = d.vehicle_id
    left join users u on u.id = d.criado_por
    left join clientes c on c.id = d.cliente_id
    left join lateral (
      select da.status, da.arquivo_assinado, da.signers
        from documento_assinaturas da
       where da.documento_id = d.id
       order by (da.status in ('uploading','uploaded','metadata_processing',
                               'metadata_ready','pending_signature','certificating')) desc,
                da.created_at desc
       limit 1
    ) a on true
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

/**
 * Guarda um PDF que não é um contrato recém-gerado — hoje, a via assinada que
 * volta do Assinafy. Fica no mesmo cofre (data/documentos/<ano>/<uuid>.pdf) e
 * no mesmo formato de caminho, então herda a validação de ARQUIVO_VALIDO e o
 * mesmo tratamento de backup do original.
 *
 * Não escreve no banco: quem chama é dono da linha que vai apontar para o
 * arquivo (documento_assinaturas.arquivo_assinado) e sabe desfazer se o insert
 * falhar.
 */
export async function salvarPdfAvulso(buffer) {
  if (!buffer?.length) throw new Error("Arquivo vazio.");
  if (buffer.length > MAX_BYTES) throw new Error("Arquivo acima de 20 MB.");
  const ano = String(new Date().getFullYear());
  const relativo = path.join(ano, `${uuidv4()}.pdf`);
  await fs.mkdir(path.join(DOCS_ROOT, ano), { recursive: true });
  await fs.writeFile(path.join(DOCS_ROOT, relativo), buffer);
  return relativo;
}

/** Apaga um PDF guardado por salvarPdfAvulso. Silencioso se já não existir. */
export async function apagarPdfAvulso(relativo) {
  if (!ARQUIVO_VALIDO.test(relativo || "")) return;
  await fs.unlink(path.join(DOCS_ROOT, relativo)).catch(() => {});
}

/**
 * Caminho absoluto de um arquivo do cofre a partir do caminho relativo, com a
 * mesma blindagem contra path traversal de getDocumentoArquivo. Null se o
 * formato não bater ou o arquivo tiver sumido do disco.
 */
export async function caminhoAbsolutoDoArquivo(relativo) {
  if (!ARQUIVO_VALIDO.test(relativo || "")) return null;
  const caminhoAbsoluto = path.join(DOCS_ROOT, relativo);
  try {
    await fs.access(caminhoAbsoluto);
  } catch {
    return null;
  }
  return caminhoAbsoluto;
}

/**
 * Os campos digitados de um contrato, para reabrir e corrigir.
 *
 * Separado da listagem porque carrega dado pessoal (CPF, CNH, endereço): a
 * tela de documentos mostra dezenas de linhas e não precisa de nada disso;
 * quem corrige pede um contrato de cada vez.
 */
export async function getDocumentoDados(id) {
  const { rows } = await query(
    `select id, tipo, titulo, dados, vehicle_id, cliente_id, created_at
       from documentos_gerados where id = $1`,
    [id]
  );
  if (!rows.length || !rows[0].dados) return null;
  return rows[0];
}

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
