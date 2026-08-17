/**
 * Cliente Assinafy (assinatura eletrônica) — server-only.
 *
 * Ativa quando as variáveis estiverem no .env.local:
 *   ASSINAFY_API_KEY        — chave permanente (painel Assinafy → API)
 *   ASSINAFY_ACCOUNT_ID     — id da conta (workspace) da Vamaq
 *   ASSINAFY_ENV            — 'sandbox' ou 'production' (default: sandbox)
 *   ASSINAFY_WEBHOOK_SECRET — segredo que vai na URL do webhook (você define)
 *
 * Sem chave, assinafyEnabled() é false e nada é chamado — mesmo padrão do
 * cliente Asaas (src/lib/fin/asaas/client.js).
 *
 * Autenticação por header `X-Api-Key`, que é o método que eles recomendam para
 * back-end. O Bearer/JWT existe mas é sessão de usuário e expira.
 */
const BASES = {
  production: "https://api.assinafy.com.br",
  sandbox: "https://sandbox.assinafy.com.br",
};

export function assinafyEnabled() {
  return Boolean(process.env.ASSINAFY_API_KEY && process.env.ASSINAFY_ACCOUNT_ID);
}

export function accountId() {
  return process.env.ASSINAFY_ACCOUNT_ID;
}

function baseUrl() {
  return BASES[process.env.ASSINAFY_ENV === "production" ? "production" : "sandbox"];
}

/**
 * Toda resposta deles vem embrulhada em { status, message, data }. `message`
 * traz o texto de erro legível — é o que vale mostrar para a Mayra, em vez de
 * um "HTTP 400" que não diz o que corrigir.
 */
async function assinafyFetch(path, { method = "GET", body, form, raw = false } = {}) {
  if (!assinafyEnabled()) {
    throw new Error("Assinafy não configurado (ASSINAFY_API_KEY/ACCOUNT_ID ausentes).");
  }

  const headers = { "X-Api-Key": process.env.ASSINAFY_API_KEY };
  // FormData monta o próprio Content-Type com o boundary; definir na mão
  // corrompe o multipart e o upload volta 400 sem explicação.
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });

  if (raw) {
    if (!res.ok) throw new Error(`Assinafy HTTP ${res.status} em ${path}`);
    return res;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Assinafy HTTP ${res.status} em ${path}`);
  }
  return data?.data;
}

/** Cria um signatário na conta. Ao menos um de email/whatsapp é necessário. */
export function createSigner({ fullName, email, whatsapp }) {
  return assinafyFetch(`/v1/accounts/${accountId()}/signers`, {
    method: "POST",
    body: {
      full_name: fullName,
      ...(email ? { email } : {}),
      ...(whatsapp ? { whatsapp_phone_number: whatsapp } : {}),
    },
  });
}

/**
 * Procura um signatário já cadastrado pelo e-mail.
 *
 * Existe para não criar um signatário novo a cada contrato do mesmo cliente —
 * quem compra o segundo carro viraria dois cadastros com o mesmo e-mail, e o
 * histórico dele lá dentro ficaria partido em dois.
 */
export async function findSignerByEmail(email) {
  if (!email) return null;
  const alvo = email.trim().toLowerCase();
  const lista = await assinafyFetch(`/v1/accounts/${accountId()}/signers`);
  if (!Array.isArray(lista)) return null;
  return lista.find((s) => (s.email || "").toLowerCase() === alvo) || null;
}

/** Sobe o PDF. Devolve o documento recém-criado, ainda em processamento. */
export async function uploadDocument({ buffer, filename }) {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "application/pdf" }), filename);
  return assinafyFetch(`/v1/accounts/${accountId()}/documents`, {
    method: "POST",
    form,
  });
}

export function getDocument(documentId) {
  return assinafyFetch(`/v1/documents/${documentId}?expand=assignment`);
}

/**
 * Pede as assinaturas. `method: 'virtual'` assina sem posicionar campo na
 * página — é o que serve para os contratos da Vamaq, que não têm rubrica em
 * ponto fixo. `collect` exigiria coordenada por campo.
 */
export function createAssignment(documentId, { signers, message, expiresAt }) {
  return assinafyFetch(`/v1/documents/${documentId}/assignments`, {
    method: "POST",
    body: {
      method: "virtual",
      signers,
      ...(message ? { message } : {}),
      ...(expiresAt ? { expires_at: expiresAt } : {}),
    },
  });
}

/**
 * Reenvia a notificação para um signatário que não recebeu ou perdeu o e-mail.
 *
 * É o caminho certo para "o cliente diz que não chegou": mandar o contrato de
 * novo do zero criaria um documento novo lá dentro e queimaria mais uma
 * unidade da cota mensal, além de deixar dois links válidos para o mesmo
 * papel. Reenviar usa o mesmo documento e não custa nada.
 */
export function resendSignatureRequest(documentId, assignmentId, signerId) {
  return assinafyFetch(
    `/v1/documents/${documentId}/assignments/${assignmentId}/signers/${signerId}/resend`,
    { method: "PUT" }
  );
}

/**
 * Baixa um artefato: 'original', 'certificated' (o assinado), 'certificate-page'
 * (a folha de validade jurídica) ou 'bundle'.
 */
export async function downloadArtifact(documentId, artifactName = "certificated") {
  const res = await assinafyFetch(`/v1/documents/${documentId}/download/${artifactName}`, {
    raw: true,
  });
  return Buffer.from(await res.arrayBuffer());
}

// A inscrição de webhook não tem função aqui de propósito: ela é configurada
// uma vez por ambiente, fora da aplicação, por scripts/assinafy-webhook.mjs —
// que roda em node puro, antes e independente do servidor estar de pé.
