/**
 * Envio de um contrato para assinatura eletrônica no Assinafy.
 *
 * Decisões de negócio que estão codificadas aqui (Lorrayne, 17/08/2026):
 *
 *   1. A Vamaq assina DEPOIS do cliente. Isso vira `step`: cliente = 1,
 *      Vamaq = 2. O Assinafy só notifica o passo 2 quando o passo 1 termina.
 *   2. A notificação vai por E-MAIL. WhatsApp automático fica desligado — o
 *      fallback é a Mayra copiar o `signing_url` e mandar na mão, e por isso
 *      esse link é guardado no banco em vez de descartado.
 *
 * O caminho feliz são três chamadas (subir PDF → cadastrar signatários →
 * pedir assinatura), mas entre a primeira e a terceira existe um
 * processamento assíncrono do lado deles. Ver garantirAssignment().
 */
import fs from "fs/promises";
import { query } from "@/lib/db";
import { BUSINESS } from "@/lib/businessInfo";
import {
  getDocumentoArquivo,
  salvarPdfAvulso,
  apagarPdfAvulso,
} from "@/lib/documentos";
import {
  assinafyEnabled,
  createSigner,
  findSignerByEmail,
  uploadDocument,
  getDocument,
  createAssignment,
  downloadArtifact,
  resendSignatureRequest,
} from "./client.js";
import {
  criarEnvio,
  registrarAssignment,
  registrarArquivoAssinado,
  atualizarStatus,
  getEnvioAtual,
  getEnvioPorAssinafyId,
  STATUS_VIVOS,
} from "./repo.js";

// Status em que o documento ainda está sendo digerido do lado deles. Só em
// `metadata_ready` o Assinafy aceita um pedido de assinatura.
const STATUS_PROCESSANDO = ["uploading", "uploaded", "metadata_processing"];

/** Quem assina pela Vamaq. Configurável, com o representante legal como padrão. */
function signatarioVamaq() {
  return {
    nome: process.env.ASSINAFY_VAMAQ_SIGNER_NAME || BUSINESS.representante,
    email: process.env.ASSINAFY_VAMAQ_SIGNER_EMAIL || BUSINESS.email,
  };
}

/**
 * O contrato + os dados de contato da outra parte.
 *
 * O e-mail vem do cadastro de clientes quando o contrato foi gerado com
 * cliente_id. Contrato antigo, gerado só com o nome em texto livre, não tem
 * de onde tirar e-mail — daí o envio exigir que a Mayra digite.
 */
async function carregarDocumento(documentoId) {
  const { rows } = await query(
    `select d.id, d.tipo, d.titulo, d.cliente, d.cliente_id,
            c.nome as cliente_nome, c.email as cliente_email, c.telefone as cliente_telefone
       from documentos_gerados d
       left join clientes c on c.id = d.cliente_id
      where d.id = $1`,
    [documentoId]
  );
  return rows[0] || null;
}

/** Reaproveita o signatário que já existe com aquele e-mail, ou cria um novo. */
async function resolverSigner({ nome, email }) {
  const existente = await findSignerByEmail(email);
  if (existente?.id) return existente;
  return createSigner({ fullName: nome, email });
}

/**
 * Espera o documento sair de "processando".
 *
 * Poll curto e não um webhook porque o caso comum é um PDF vetorial de poucos
 * KB, pronto em 1 ou 2 segundos, e fazer a Mayra esperar um webhook para ver
 * "enviado" na tela seria pior. Se estourar o prazo, o envio NÃO é perdido: a
 * linha fica gravada e garantirAssignment() termina o serviço depois, chamada
 * pelo webhook ou pela própria tela ao consultar o status.
 */
async function esperarMetadataReady(assinafyDocumentId, { tentativas = 12, intervaloMs = 1500 } = {}) {
  let doc = null;
  for (let i = 0; i < tentativas; i++) {
    doc = await getDocument(assinafyDocumentId);
    if (doc?.status === "failed") {
      throw new Error("O Assinafy não conseguiu processar este PDF.");
    }
    if (!STATUS_PROCESSANDO.includes(doc?.status)) return doc;
    await new Promise((r) => setTimeout(r, intervaloMs));
  }
  return doc; // ainda processando — quem chamou decide o que fazer
}

/**
 * Cria o pedido de assinatura de um envio que já tem o PDF lá dentro mas ainda
 * não tem assignment.
 *
 * Isolado em função própria porque tem dois chamadores: o envio original (caso
 * comum, logo depois do upload) e o webhook de `document_metadata_ready` (caso
 * do PDF que demorou mais que o poll). Idempotente: se o assignment já existe,
 * devolve o envio como está.
 */
export async function garantirAssignment(envio) {
  if (envio.assinafy_assignment_id) return envio;

  const doc = await getDocument(envio.assinafy_document_id);
  if (STATUS_PROCESSANDO.includes(doc?.status)) return envio; // ainda não deu tempo

  // PDF que o Assinafy não conseguiu ler. Sem marcar como morto, este envio
  // ficaria para sempre num status "vivo" — e o índice parcial do banco, que
  // impede duas coletas ao mesmo tempo, travaria o documento de vez: a Mayra
  // não conseguiria mais enviar aquele contrato, sem nenhuma explicação na
  // tela. Marcar libera o reenvio.
  if (doc?.status === "failed") {
    return (
      (await atualizarStatus(envio.assinafy_document_id, {
        status: "failed",
        raw: doc,
      })) || envio
    );
  }

  const signers = Array.isArray(envio.signers) ? envio.signers : [];
  if (!signers.length) throw new Error("Envio sem signatários registrados.");

  const assignment = await createAssignment(envio.assinafy_document_id, {
    signers: signers.map((s) => ({
      id: s.assinafy_signer_id,
      verification_method: "Email",
      notification_methods: ["Email"],
      step: s.step,
    })),
    // O título nem sempre está na linha (quando quem chama é o webhook, ela
    // veio do banco sem o join com documentos_gerados) — montar a frase por
    // partes evita o "Contrato  — Vamaq Motors" com buraco no meio.
    message: ["Contrato", envio.titulo, "—", BUSINESS.tradeName]
      .filter(Boolean)
      .join(" "),
  });

  // signing_urls vem indexado por signer_id; casa com a nossa lista para que
  // cada linha guarde o próprio link.
  const urls = new Map(
    (assignment?.signing_urls || []).map((u) => [u.signer_id, u.url])
  );
  const comUrl = signers.map((s) => ({
    ...s,
    signing_url: urls.get(s.assinafy_signer_id) || s.signing_url || null,
  }));

  return registrarAssignment(envio.id, {
    assignmentId: assignment?.id || null,
    status: "pending_signature",
    signers: comUrl,
    raw: assignment,
  });
}

/**
 * Manda um contrato já gerado para assinatura.
 *
 * `emailCliente` só é necessário quando o contrato não está ligado a um
 * cliente com e-mail no cadastro.
 */
export async function enviarParaAssinatura({ documentoId, emailCliente, nomeCliente, usuarioId }) {
  if (!assinafyEnabled()) {
    return { error: "Assinatura eletrônica não configurada neste ambiente." };
  }

  const doc = await carregarDocumento(documentoId);
  if (!doc) return { error: "Documento não encontrado." };

  // Um contrato não pode estar em duas coletas ao mesmo tempo: seriam dois
  // links válidos e duas vias assinadas diferentes do mesmo papel.
  const atual = await getEnvioAtual(documentoId);
  if (atual && STATUS_VIVOS.includes(atual.status)) {
    return { error: "Este documento já está aguardando assinatura.", envio: atual };
  }

  const nome = (nomeCliente || doc.cliente_nome || doc.cliente || "").trim();
  const email = (emailCliente || doc.cliente_email || "").trim();
  if (!nome) return { error: "O documento não identifica quem vai assinar." };
  if (!email) {
    return { error: "Sem e-mail do cliente. Informe um e-mail para enviar o contrato." };
  }

  const arquivo = await getDocumentoArquivo(documentoId);
  if (!arquivo) return { error: "O PDF deste documento não está mais no servidor." };
  const buffer = await fs.readFile(arquivo.caminhoAbsoluto);

  // 1. Signatários — cliente primeiro, Vamaq depois (decisão de negócio).
  const vamaq = signatarioVamaq();
  const [signerCliente, signerVamaq] = await Promise.all([
    resolverSigner({ nome, email }),
    resolverSigner({ nome: vamaq.nome, email: vamaq.email }),
  ]);

  const signers = [
    {
      papel: "cliente",
      nome,
      email,
      assinafy_signer_id: signerCliente.id,
      step: 1,
      signing_url: null,
      assinado_em: null,
    },
    {
      papel: "vamaq",
      nome: vamaq.nome,
      email: vamaq.email,
      assinafy_signer_id: signerVamaq.id,
      step: 2,
      signing_url: null,
      assinado_em: null,
    },
  ];

  // 2. Sobe o PDF.
  const nomeArquivo = `${(doc.titulo || "contrato").replace(/[^\w\s.-]/g, "").trim() || "contrato"}.pdf`;
  const remoto = await uploadDocument({ buffer, filename: nomeArquivo });
  if (!remoto?.id) return { error: "O Assinafy não devolveu o documento criado." };

  // Grava antes de pedir a assinatura: se a terceira chamada falhar, o PDF já
  // está lá dentro e a linha permite retomar em vez de subir tudo de novo.
  let envio = await criarEnvio({
    documentoId,
    assinafyDocumentId: remoto.id,
    status: remoto.status || "uploaded",
    signers,
    enviadoPor: usuarioId,
    raw: remoto,
  });
  envio.titulo = doc.titulo;

  // 3. Espera processar e pede as assinaturas.
  const processado = await esperarMetadataReady(remoto.id);
  if (STATUS_PROCESSANDO.includes(processado?.status)) {
    return {
      envio,
      aviso:
        "O PDF subiu, mas o Assinafy ainda está processando. O pedido de assinatura sai sozinho assim que ficar pronto.",
    };
  }

  envio = await garantirAssignment(envio);
  return { envio };
}

/**
 * Traz a via assinada para o cofre, se ela já existir do lado deles.
 *
 * POR QUE ISTO NÃO É SÓ UM `if (evento === 'document_ready') baixa`:
 *
 * O Assinafy NÃO tem evento para "certificação concluída". A lista completa
 * (GET /v1/webhooks/event-types) termina em `document_ready`, que dispara
 * quando o ÚLTIMO signatário assina — e nesse instante o documento ainda está
 * em `certificating`. A passagem de `certificating` para `certificated`
 * acontece depois, sozinha, e não avisa ninguém.
 *
 * Ou seja: baixar direto no `document_ready` funcionaria nas vezes em que a
 * certificação fosse rápida e falharia calado nas outras, deixando contratos
 * assinados sem via guardada — e ninguém perceberia até precisar do documento.
 *
 * Daí o desenho: esta função é idempotente, confere o status ao vivo, e é
 * chamada de três lugares — o webhook (com uma espera curta), a tela ao
 * consultar o status, e o próprio webhook em reentregas.
 */
export async function garantirViaAssinada(assinafyDocumentId, { tentativas = 1, intervaloMs = 3000 } = {}) {
  const envio = await getEnvioPorAssinafyId(assinafyDocumentId);
  if (!envio) return null;
  if (envio.arquivo_assinado) return envio;

  let doc = null;
  for (let i = 0; i < tentativas; i++) {
    doc = await getDocument(assinafyDocumentId);
    if (doc?.status === "certificated") break;
    if (doc?.status !== "certificating") return envio; // não é caso de baixar
    if (i < tentativas - 1) await new Promise((r) => setTimeout(r, intervaloMs));
  }
  if (doc?.status !== "certificated") return envio; // ainda certificando; fica para a próxima

  const buffer = await downloadArtifact(assinafyDocumentId, "certificated");
  const relativo = await salvarPdfAvulso(buffer);
  try {
    return await registrarArquivoAssinado(assinafyDocumentId, relativo);
  } catch (err) {
    // Sem a linha apontando para ele, o arquivo é inalcançável — não deixa lixo.
    await apagarPdfAvulso(relativo);
    throw err;
  }
}

/**
 * Reenvia a notificação para quem ainda não assinou.
 *
 * Existe para o caso mais comum de todos — "o cliente diz que não recebeu o
 * e-mail". A alternativa seria mandar o contrato de novo pelo botão de envio,
 * que sobe um documento NOVO no Assinafy: gasta mais uma unidade das 100 do
 * mês e deixa dois links válidos para a mesma assinatura. Reenviar reaproveita
 * o mesmo documento e não custa cota.
 *
 * Só notifica quem falta: reenviar para quem já assinou é confuso para o
 * cliente e inútil para a loja.
 */
export async function reenviarNotificacao(documentoId) {
  const envio = await getEnvioAtual(documentoId);
  if (!envio) return { error: "Este documento não foi enviado para assinatura." };
  if (!envio.assinafy_assignment_id) {
    return { error: "O pedido de assinatura ainda não foi criado. Tente de novo em instantes." };
  }
  if (!STATUS_VIVOS.includes(envio.status)) {
    return { error: "Este envio não está mais aguardando assinatura." };
  }

  const pendentes = (Array.isArray(envio.signers) ? envio.signers : []).filter(
    (s) => !s.assinado_em
  );
  if (!pendentes.length) return { error: "Todos os signatários já assinaram." };

  for (const s of pendentes) {
    await resendSignatureRequest(
      envio.assinafy_document_id,
      envio.assinafy_assignment_id,
      s.assinafy_signer_id
    );
  }
  return { reenviados: pendentes.map((s) => s.nome) };
}
