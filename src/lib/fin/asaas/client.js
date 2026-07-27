/**
 * Cliente Asaas (cobrança boleto/pix) — preparação da integração (ADR-001a §4).
 *
 * Ativa quando as variáveis estiverem no .env.local:
 *   ASAAS_API_KEY       — chave da conta Asaas (a Vamaq gera no painel Asaas)
 *   ASAAS_ENV           — 'sandbox' (teste) ou 'production' (default: sandbox)
 *   ASAAS_WEBHOOK_TOKEN — token que o webhook confere (você define e cola no Asaas)
 *
 * Sem ASAAS_API_KEY, asaasEnabled() é false e nada é chamado. Nenhuma cobrança
 * é criada automaticamente — quem dispara é uma ação do operador no admin.
 */
const BASES = {
  production: "https://api.asaas.com/v3",
  sandbox: "https://sandbox.asaas.com/api/v3",
};

export function asaasEnabled() {
  return Boolean(process.env.ASAAS_API_KEY);
}

function baseUrl() {
  return BASES[process.env.ASAAS_ENV === "production" ? "production" : "sandbox"];
}

async function asaasFetch(path, { method = "GET", body } = {}) {
  if (!asaasEnabled()) throw new Error("Asaas não configurado (ASAAS_API_KEY ausente).");
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      access_token: process.env.ASAAS_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.errors?.[0]?.description || `Asaas HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/** Cria (ou reaproveita) um cliente no Asaas. */
export function createCustomer({ name, cpfCnpj, email, phone }) {
  return asaasFetch("/customers", { method: "POST", body: { name, cpfCnpj, email, phone } });
}

/** Cria uma cobrança. billingType: 'BOLETO' | 'PIX' | 'CREDIT_CARD'. */
export function createPayment({ customer, billingType, value, dueDate, description, externalReference }) {
  return asaasFetch("/payments", {
    method: "POST",
    body: { customer, billingType, value, dueDate, description, externalReference },
  });
}

export function getPayment(id) {
  return asaasFetch(`/payments/${id}`);
}

export function listPayments(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return asaasFetch(`/payments${qs ? `?${qs}` : ""}`);
}
