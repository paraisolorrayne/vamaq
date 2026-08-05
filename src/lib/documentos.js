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

const DOCS_ROOT = path.join(process.cwd(), "data", "documentos");
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB — um contrato em PDF vetorial tem poucos KB
const TIPOS = ["compra-venda", "venda", "consignacao", "termo-vistoria"];

export async function salvarDocumento({ tipo, titulo, cliente, vehicleId, criadoPor, buffer }) {
  if (!TIPOS.includes(tipo)) return { error: "Tipo de documento desconhecido." };
  if (!titulo) return { error: "Documento sem título." };
  if (!buffer?.length) return { error: "Arquivo vazio." };
  if (buffer.length > MAX_BYTES) return { error: "Arquivo acima de 20 MB." };

  const ano = String(new Date().getFullYear());
  const relativo = path.join(ano, `${uuidv4()}.pdf`);
  await fs.mkdir(path.join(DOCS_ROOT, ano), { recursive: true });
  await fs.writeFile(path.join(DOCS_ROOT, relativo), buffer);

  const { rows } = await query(
    `insert into documentos_gerados (tipo, titulo, cliente, vehicle_id, arquivo, tamanho, criado_por)
     values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [tipo, titulo, cliente || null, vehicleId || null, relativo, buffer.length, criadoPor || null]
  );
  return { documento: rows[0] };
}

const SELECT = `
  select d.*, v.brand, v.model, v.year, v.placa, u.name as criado_por_nome
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
        [`%${termo}%`]
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

/** Caminho absoluto do PDF, ou null se a linha ou o arquivo não existirem. */
export async function getDocumentoArquivo(id) {
  const { rows } = await query(
    `select titulo, arquivo from documentos_gerados where id = $1`,
    [id]
  );
  if (!rows.length) return null;
  const caminhoAbsoluto = path.join(DOCS_ROOT, rows[0].arquivo);
  try {
    await fs.access(caminhoAbsoluto);
  } catch {
    return null; // linha no banco, arquivo sumiu do disco
  }
  return { caminhoAbsoluto, titulo: rows[0].titulo };
}
