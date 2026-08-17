/**
 * Persistência dos envios para assinatura (tabela documento_assinaturas).
 *
 * Separado de envio.js de propósito: aqui só entra SQL, lá só entra a conversa
 * com o Assinafy. O webhook usa este módulo sem arrastar o cliente HTTP junto.
 */
import { query } from "@/lib/db";

// Estados em que o envio ainda está correndo. Precisa ser igual à lista do
// índice parcial em db/assinatura-schema.sql — se as duas divergirem, a tela
// libera um reenvio que o banco recusa, e a Mayra leva um erro sem explicação.
export const STATUS_VIVOS = [
  "uploading",
  "uploaded",
  "metadata_processing",
  "metadata_ready",
  "pending_signature",
  "certificating",
];

export const STATUS_FINAL_OK = "certificated";

export async function criarEnvio({
  documentoId,
  assinafyDocumentId,
  status,
  signers,
  enviadoPor,
  raw,
}) {
  const { rows } = await query(
    `insert into documento_assinaturas
       (documento_id, assinafy_document_id, status, signers, enviado_por, raw)
     values ($1,$2,$3,$4::jsonb,$5,$6::jsonb)
     returning *`,
    [
      documentoId,
      assinafyDocumentId,
      status || "uploaded",
      JSON.stringify(signers || []),
      enviadoPor || null,
      raw ? JSON.stringify(raw) : null,
    ]
  );
  return rows[0];
}

export async function registrarAssignment(id, { assignmentId, status, signers, raw }) {
  const { rows } = await query(
    `update documento_assinaturas
        set assinafy_assignment_id = $2,
            status = coalesce($3, status),
            signers = $4::jsonb,
            raw = coalesce($5::jsonb, raw)
      where id = $1
      returning *`,
    [id, assignmentId, status || null, JSON.stringify(signers || []), raw ? JSON.stringify(raw) : null]
  );
  return rows[0];
}

/**
 * Atualiza o status vindo do Assinafy.
 *
 * `signers` só é sobrescrito quando vem preenchido: um evento de status pode
 * não trazer a lista, e gravar `[]` por cima apagaria os signing_urls — que é
 * justamente o que a Mayra usa como fallback no WhatsApp.
 */
export async function atualizarStatus(assinafyDocumentId, { status, signers, recusaMotivo, raw }) {
  const { rows } = await query(
    `update documento_assinaturas
        set status = $2,
            signers = case when $3::jsonb is null or $3::jsonb = '[]'::jsonb
                           then signers else $3::jsonb end,
            recusa_motivo = coalesce($4, recusa_motivo),
            raw = coalesce($5::jsonb, raw)
      where assinafy_document_id = $1
      returning *`,
    [
      assinafyDocumentId,
      status,
      signers ? JSON.stringify(signers) : null,
      recusaMotivo || null,
      raw ? JSON.stringify(raw) : null,
    ]
  );
  return rows[0] || null;
}

export async function registrarArquivoAssinado(assinafyDocumentId, arquivoRelativo) {
  const { rows } = await query(
    `update documento_assinaturas
        set arquivo_assinado = $2,
            assinado_em = coalesce(assinado_em, now()),
            status = 'certificated'
      where assinafy_document_id = $1
      returning *`,
    [assinafyDocumentId, arquivoRelativo]
  );
  return rows[0] || null;
}

export async function getEnvioPorAssinafyId(assinafyDocumentId) {
  const { rows } = await query(
    `select * from documento_assinaturas where assinafy_document_id = $1`,
    [assinafyDocumentId]
  );
  return rows[0] || null;
}

/** O envio que está valendo para um documento — o vivo, ou o último de todos. */
export async function getEnvioAtual(documentoId) {
  const { rows } = await query(
    `select * from documento_assinaturas
      where documento_id = $1
      order by (status = any($2)) desc, created_at desc
      limit 1`,
    [documentoId, STATUS_VIVOS]
  );
  return rows[0] || null;
}

export async function listEnviosDoDocumento(documentoId) {
  const { rows } = await query(
    `select * from documento_assinaturas
      where documento_id = $1
      order by created_at desc`,
    [documentoId]
  );
  return rows;
}

// Não existe função para apagar envio de propósito: envio é histórico. Um
// contrato que foi mandado e recusado precisa continuar mostrando que foi
// mandado e recusado. O que "destrava" o documento para um novo envio é o
// status sair da lista de vivos (ver STATUS_VIVOS), não a linha sumir.
