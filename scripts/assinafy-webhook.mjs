#!/usr/bin/env node
/**
 * Configura (ou mostra) a inscrição de webhook do Assinafy.
 *
 * O painel deles permite fazer isto na mão, mas a URL leva um segredo dentro
 * — ASSINAFY_WEBHOOK_SECRET — e digitar segredo à mão é como ele acaba errado
 * ou parando num histórico de navegador. Aqui ele sai direto do .env.
 *
 * RODAR SÓ DEPOIS DO DEPLOY: o Assinafy valida a URL na hora de gravar, e
 * apontar para uma rota que ainda não existe grava uma inscrição quebrada.
 *
 * Uso:
 *   node --env-file=.env.local scripts/assinafy-webhook.mjs            # mostra
 *   node --env-file=.env.local scripts/assinafy-webhook.mjs --aplicar  # grava
 *
 * Variáveis: ASSINAFY_API_KEY, ASSINAFY_ACCOUNT_ID, ASSINAFY_WEBHOOK_SECRET,
 *            ASSINAFY_WEBHOOK_BASE_URL (default https://vamaqmotors.com.br)
 */
const { ASSINAFY_API_KEY, ASSINAFY_ACCOUNT_ID, ASSINAFY_WEBHOOK_SECRET } = process.env;
const BASE_API =
  process.env.ASSINAFY_ENV === "production"
    ? "https://api.assinafy.com.br"
    : "https://sandbox.assinafy.com.br";
const SITE = process.env.ASSINAFY_WEBHOOK_BASE_URL || "https://vamaqmotors.com.br";

// Só os eventos que movem alguma coisa no nosso lado. Assinar tudo encheria o
// log de ruído (signer_viewed_document dispara a cada abertura) sem mudar nada
// do que a tela mostra.
const EVENTOS = [
  "document_metadata_ready", // destrava o pedido de assinatura que o poll não pegou
  "signer_signed_document", // "cliente assinou, falta a Vamaq"
  "signer_rejected_document", // recusa
  "user_rejected_document", // cancelamento
  "document_ready", // último assinou → começa a busca da via certificada
  "document_processing_failed", // PDF que o Assinafy não conseguiu ler
];

// Não existe evento para "certificação concluída": `document_ready` dispara
// quando o último assina, com o documento ainda em `certificating`. Por isso a
// via assinada é buscada com uma espera curta no webhook e, se ainda não
// estiver pronta, ao abrir a tela de documentos. Ver garantirViaAssinada() em
// src/lib/assinatura/envio.js.

if (!ASSINAFY_API_KEY || !ASSINAFY_ACCOUNT_ID) {
  console.error("Faltam ASSINAFY_API_KEY e/ou ASSINAFY_ACCOUNT_ID no ambiente.");
  process.exit(1);
}

async function api(path, init = {}) {
  const res = await fetch(`${BASE_API}${path}`, {
    ...init,
    headers: { "X-Api-Key": ASSINAFY_API_KEY, "Content-Type": "application/json", ...init.headers },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `HTTP ${res.status} em ${path}`);
  return json.data;
}

// O `token=` da URL É o segredo do webhook. Imprimir cru deixaria ele no
// scrollback do terminal e no histórico de quem rodou — inclusive na consulta,
// que é o modo em que o script mais é usado.
function mascararToken(url) {
  if (!url) return "(nenhuma)";
  return url.replace(/([?&]token=)[^&]+/, "$1***");
}

const atual = await api(`/v1/accounts/${ASSINAFY_ACCOUNT_ID}/webhooks/subscriptions`);
console.log("Inscrição atual:");
console.log(`  url:      ${mascararToken(atual?.url)}`);
console.log(`  ativa:    ${atual?.is_active}`);
console.log(`  eventos:  ${(atual?.events || []).join(", ") || "(nenhum)"}`);

if (!process.argv.includes("--aplicar")) {
  console.log("\nNada foi alterado. Rode com --aplicar para gravar.");
  process.exit(0);
}

if (!ASSINAFY_WEBHOOK_SECRET) {
  console.error("\nFalta ASSINAFY_WEBHOOK_SECRET — sem ele o webhook responde 503 de propósito.");
  process.exit(1);
}

const url = `${SITE}/api/webhooks/assinafy?token=${ASSINAFY_WEBHOOK_SECRET}`;
const novo = await api(`/v1/accounts/${ASSINAFY_ACCOUNT_ID}/webhooks/subscriptions`, {
  method: "PUT",
  body: JSON.stringify({
    url,
    events: EVENTOS,
    email: process.env.ASSINAFY_WEBHOOK_EMAIL || "contato@vamaqmotors.com.br",
    is_active: true,
  }),
});

console.log("\nGravado:");
// O segredo não vai para o terminal — o histórico do shell é um lugar ruim
// para ele morar.
console.log(`  url:      ${SITE}/api/webhooks/assinafy?token=***`);
console.log(`  eventos:  ${(novo?.events || EVENTOS).join(", ")}`);
console.log("\nConferir entregas:  GET /v1/accounts/<conta>/webhooks");
