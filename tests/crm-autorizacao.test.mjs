/**
 * Matriz de autorização das rotas do CRM (src/app/api/admin/crm/).
 *
 * O defeito nº1 que esta entrega corrigiu: a seção `crm` é de
 * ["vendedor","secretaria"] no menu (ver src/app/admin/layout.js), mas as
 * guardas da API exigiam só ["vendedor"] — a secretaria abria a tela e via
 * um funil vazio, sem erro nenhum, porque todo GET voltava 403 e a lista
 * caía silenciosamente para vazia. O CRM ficou meses sem uso provavelmente
 * por causa disso. É a mesma classe de defeito que
 * tests/clientes-autorizacao.test.mjs documenta ter passado por seis
 * revisões — este arquivo copia a estrutura de lá.
 *
 * Isolamento de sessão, resolução do alias "@/" e das extensões de
 * "next/server"/"next/headers": ver tests/helpers/mock-session-loader.mjs
 * (mesmo hook, reaproveitado sem mudança).
 *
 * O banco não é mockado: sem DATABASE_URL no ambiente de teste, `query()`
 * (src/lib/db.js) devolve `{rows: []}` em vez de lançar — os casos
 * permitidos passam da guarda e continuam para 200/400/404, nunca 403. Só
 * verificamos "não é 403" para quem pode, e "é 403" para quem não pode.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./tests/helpers/mock-session-loader.mjs", pathToFileURL("./"));

import { test } from "node:test";
import assert from "node:assert/strict";

const UUID = "00000000-0000-0000-0000-000000000000";

const oportunidadesRoute = await import("../src/app/api/admin/crm/oportunidades/route.js");
const oportunidadeIdRoute = await import("../src/app/api/admin/crm/oportunidades/[id]/route.js");

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

// Uma linha por handler das rotas do CRM. `permitidos` é a matriz do
// enunciado: vendedor, secretaria e admin não recebem 403; estoque e
// financeiro recebem 403 em todos.
const ROTAS = [
  {
    nome: "GET /crm/oportunidades",
    permitidos: ["vendedor", "secretaria", "admin"],
    chamar: () =>
      oportunidadesRoute.GET(reqGet("http://localhost/api/admin/crm/oportunidades")),
  },
  {
    nome: "POST /crm/oportunidades",
    permitidos: ["vendedor", "secretaria", "admin"],
    chamar: () =>
      oportunidadesRoute.POST(
        reqJson("http://localhost/api/admin/crm/oportunidades", "POST", {
          cliente_nome: "Fulano de Teste",
        })
      ),
  },
  {
    nome: "GET /crm/oportunidades/[id]",
    permitidos: ["vendedor", "secretaria", "admin"],
    chamar: () =>
      oportunidadeIdRoute.GET(
        reqGet(`http://localhost/api/admin/crm/oportunidades/${UUID}`),
        ctxComId()
      ),
  },
  {
    nome: "PUT /crm/oportunidades/[id]",
    permitidos: ["vendedor", "secretaria", "admin"],
    chamar: () =>
      oportunidadeIdRoute.PUT(
        reqJson(`http://localhost/api/admin/crm/oportunidades/${UUID}`, "PUT", {
          cliente_nome: "Fulano Editado",
        }),
        ctxComId()
      ),
  },
  {
    nome: "PATCH /crm/oportunidades/[id]",
    permitidos: ["vendedor", "secretaria", "admin"],
    chamar: () =>
      oportunidadeIdRoute.PATCH(
        reqJson(`http://localhost/api/admin/crm/oportunidades/${UUID}`, "PATCH", {
          etapa: "contato",
        }),
        ctxComId()
      ),
  },
  {
    nome: "DELETE /crm/oportunidades/[id]",
    permitidos: ["vendedor", "secretaria", "admin"],
    chamar: () =>
      oportunidadeIdRoute.DELETE(
        reqGet(`http://localhost/api/admin/crm/oportunidades/${UUID}`),
        ctxComId()
      ),
  },
];

// admin sempre passa (requireApiRole libera antes de olhar a lista de
// papéis) — incluído mesmo assim na varredura para provar isso também.
const PAPEIS = ["vendedor", "secretaria", "admin", "estoque", "financeiro"];

for (const rota of ROTAS) {
  for (const papel of PAPEIS) {
    const permitido = rota.permitidos.includes(papel);
    test(`${rota.nome} — ${papel} ${permitido ? "passa da guarda" : "é barrado com 403"}`, async () => {
      globalThis.__TEST_SESSION_USER__ = { id: `u-${papel}`, role: papel };
      const res = await rota.chamar();
      if (permitido) {
        assert.notEqual(
          res.status,
          403,
          `esperava que ${papel} passasse da guarda em ${rota.nome}, recebeu 403`
        );
      } else {
        assert.equal(
          res.status,
          403,
          `esperava 403 para ${papel} em ${rota.nome}, recebeu ${res.status}`
        );
      }
    });
  }
}

test("sem sessão: 401, não 403 — a guarda distingue não-autenticado de sem-permissão", async () => {
  globalThis.__TEST_SESSION_USER__ = null;
  const res = await oportunidadesRoute.GET(
    reqGet("http://localhost/api/admin/crm/oportunidades")
  );
  assert.equal(res.status, 401);
});
