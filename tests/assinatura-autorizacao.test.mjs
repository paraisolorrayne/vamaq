/**
 * Autorização das rotas de assinatura eletrônica e blindagem do webhook.
 *
 * Duas fronteiras diferentes num arquivo só, porque as duas guardam a mesma
 * coisa — quem pode mexer num contrato:
 *
 *   1. /api/admin/documentos-gerados/[id]/assinatura* exige sessão, com a
 *      mesma matriz das outras rotas de documento (vendedor e secretaria
 *      passam; estoque não). Enviar contrato para assinatura é ato de venda.
 *
 *   2. /api/webhooks/assinafy NÃO tem sessão — quem chama é o Assinafy. E o
 *      Assinafy NÃO assina os eventos: a inscrição de webhook aceita só url,
 *      events, is_active e email, sem segredo compartilhado nem header de
 *      assinatura. A única barreira possível é o segredo na própria URL, e é
 *      exatamente por isso que ela precisa de teste: se o `token` parar de
 *      ser conferido, qualquer um na internet posta "documento assinado" no
 *      endpoint. O teste abaixo fixa esse contrato.
 *
 * Mesma técnica de isolamento de sessão dos outros testes de autorização —
 * ver o cabeçalho de tests/clientes-autorizacao.test.mjs e
 * tests/helpers/mock-session-loader.mjs.
 *
 * Nenhuma chamada de rede acontece aqui: sem ASSINAFY_API_KEY no ambiente,
 * assinafyEnabled() é false e os handlers param antes de falar com a API;
 * e o webhook para no token, antes de qualquer coisa.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./tests/helpers/mock-session-loader.mjs", pathToFileURL("./"));

import { test } from "node:test";
import assert from "node:assert/strict";

const UUID = "00000000-0000-0000-0000-000000000000";

// Garante que o teste nunca fale com a API de verdade, mesmo que alguém rode
// a suíte com o .env.local carregado.
delete process.env.ASSINAFY_API_KEY;
delete process.env.ASSINAFY_ACCOUNT_ID;

const assinaturaRoute = await import(
  "../src/app/api/admin/documentos-gerados/[id]/assinatura/route.js"
);
const reenviarRoute = await import(
  "../src/app/api/admin/documentos-gerados/[id]/assinatura/reenviar/route.js"
);
const assinadoRoute = await import(
  "../src/app/api/admin/documentos-gerados/[id]/assinado/route.js"
);
const webhookRoute = await import("../src/app/api/webhooks/assinafy/route.js");

function reqGet(url) {
  return new Request(url);
}

function reqJson(url, method, body) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

function ctxComId() {
  return { params: Promise.resolve({ id: UUID }) };
}

const BASE = `http://localhost/api/admin/documentos-gerados/${UUID}`;

// A matriz é a mesma das outras rotas de documento gerado (ver
// src/app/api/admin/documentos-gerados/route.js): vendedor e secretaria.
const ROTAS = [
  {
    nome: "GET /documentos-gerados/[id]/assinatura",
    permitidos: ["vendedor", "secretaria", "admin"],
    chamar: () => assinaturaRoute.GET(reqGet(`${BASE}/assinatura`), ctxComId()),
  },
  {
    nome: "POST /documentos-gerados/[id]/assinatura",
    permitidos: ["vendedor", "secretaria", "admin"],
    chamar: () =>
      assinaturaRoute.POST(reqJson(`${BASE}/assinatura`, "POST", {}), ctxComId()),
  },
  {
    nome: "POST /documentos-gerados/[id]/assinatura/reenviar",
    permitidos: ["vendedor", "secretaria", "admin"],
    chamar: () =>
      reenviarRoute.POST(reqJson(`${BASE}/assinatura/reenviar`, "POST", {}), ctxComId()),
  },
  {
    nome: "GET /documentos-gerados/[id]/assinado",
    permitidos: ["vendedor", "secretaria", "admin"],
    chamar: () => assinadoRoute.GET(reqGet(`${BASE}/assinado`), ctxComId()),
  },
];

const PAPEIS = ["secretaria", "financeiro", "vendedor", "admin", "estoque"];

for (const rota of ROTAS) {
  for (const papel of PAPEIS) {
    const permitido = rota.permitidos.includes(papel);
    test(`${rota.nome} — ${papel} ${permitido ? "passa da guarda" : "é barrado com 403"}`, async () => {
      globalThis.__TEST_SESSION_USER__ = { id: `u-${papel}`, role: papel };
      const res = await rota.chamar();
      if (permitido) {
        assert.notEqual(res.status, 403, `esperava que ${papel} passasse em ${rota.nome}`);
      } else {
        assert.equal(res.status, 403, `esperava 403 para ${papel} em ${rota.nome}`);
      }
    });
  }
}

test("sem sessão: 401, não 403", async () => {
  globalThis.__TEST_SESSION_USER__ = null;
  const res = await assinaturaRoute.GET(reqGet(`${BASE}/assinatura`), ctxComId());
  assert.equal(res.status, 401);
});

test("envio sem o Assinafy configurado devolve erro claro, não 500", async () => {
  globalThis.__TEST_SESSION_USER__ = { id: "u", role: "admin" };
  const res = await assinaturaRoute.POST(reqJson(`${BASE}/assinatura`, "POST", {}), ctxComId());
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /não configurada/i);
});

// ── Webhook ────────────────────────────────────────────────────────────────

const WEBHOOK = "http://localhost/api/webhooks/assinafy";

test("webhook sem segredo configurado fica desligado (503), não aberto", async () => {
  delete process.env.ASSINAFY_WEBHOOK_SECRET;
  const res = await webhookRoute.POST(reqJson(`${WEBHOOK}?token=qualquer`, "POST", {}));
  assert.equal(res.status, 503);
});

test("webhook sem token é recusado", async () => {
  process.env.ASSINAFY_WEBHOOK_SECRET = "segredo-de-teste";
  const res = await webhookRoute.POST(reqJson(WEBHOOK, "POST", {}));
  assert.equal(res.status, 401);
});

test("webhook com token errado é recusado", async () => {
  process.env.ASSINAFY_WEBHOOK_SECRET = "segredo-de-teste";
  const res = await webhookRoute.POST(reqJson(`${WEBHOOK}?token=errado`, "POST", {}));
  assert.equal(res.status, 401);
});

test("webhook com token de tamanho diferente é recusado sem estourar", async () => {
  // A comparação é timingSafeEqual, que LANÇA se os buffers têm tamanhos
  // diferentes. Sem a checagem de comprimento antes, este caso viraria 500 —
  // e um 500 é uma resposta útil demais para quem está adivinhando o segredo.
  process.env.ASSINAFY_WEBHOOK_SECRET = "segredo-de-teste";
  const res = await webhookRoute.POST(reqJson(`${WEBHOOK}?token=x`, "POST", {}));
  assert.equal(res.status, 401);
});

test("webhook com token certo aceita, e evento sem documento não vira erro", async () => {
  // O teste de conexão do painel do Assinafy manda um corpo sem documento.
  // Responder erro faria a inscrição aparecer como quebrada lá.
  process.env.ASSINAFY_WEBHOOK_SECRET = "segredo-de-teste";
  const res = await webhookRoute.POST(
    reqJson(`${WEBHOOK}?token=segredo-de-teste`, "POST", { event: "ping" })
  );
  assert.equal(res.status, 200);
});

test("webhook com corpo inválido devolve 400", async () => {
  process.env.ASSINAFY_WEBHOOK_SECRET = "segredo-de-teste";
  const req = new Request(`${WEBHOOK}?token=segredo-de-teste`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "isto não é json",
  });
  const res = await webhookRoute.POST(req);
  assert.equal(res.status, 400);
});
