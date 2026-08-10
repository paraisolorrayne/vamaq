/**
 * Matriz de autorização de src/app/api/admin/vehicles/[id]/route.js.
 *
 * O PATCH muda o status do veículo — tira carro do site (ver
 * podeMarcarVendido/setVehicleStatus) — e até esta entrega exigia só
 * `requireApiRole()` sem papel: qualquer usuário logado, de qualquer papel,
 * passava. Isso foi corrigido junto da entrega de marcar vendido pelo
 * Estoque (docs/superpowers/specs/2026-08-10-marcar-vendido-design.md):
 * agora exige um dos quatro papéis que já veem o Estoque — os mesmos de
 * src/app/admin/estoque/page.js. Como esses quatro papéis são exatamente os
 * quatro não-admin que existem no sistema (ver ROLES em
 * src/lib/auth/permissions.js), a mudança não bloqueia ninguém que usa a
 * tela hoje; o teste existe para travar a lista, não para provar um bloqueio
 * que ainda não existe.
 *
 * GET/PUT/DELETE continuam fora do escopo desta entrega — mantidos com
 * `requireApiRole()` sem papel (qualquer logado passa) — e entram aqui só
 * para não deixar a rota inteira sem cobertura de regressão.
 *
 * Mesmo arnês de tests/crm-autorizacao.test.mjs e
 * tests/clientes-autorizacao.test.mjs (tests/helpers/mock-session-loader.mjs):
 * o banco não é mockado, então sem DATABASE_URL as funções de
 * src/lib/vehicleStore.js ou não fazem nada (getPool() null) ou lançam
 * ("DATABASE_URL ausente" em setVehicleStatus, capturado pelo try/catch do
 * PATCH e devolvido como 400) — nunca 403. Só verificamos "não é 403" para
 * quem pode, e "é 403" para quem não pode.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./tests/helpers/mock-session-loader.mjs", pathToFileURL("./"));

import { test } from "node:test";
import assert from "node:assert/strict";

const UUID = "00000000-0000-0000-0000-000000000000";

const vehicleIdRoute = await import("../src/app/api/admin/vehicles/[id]/route.js");

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

const TODOS = ["admin", "estoque", "financeiro", "vendedor", "secretaria"];

const ROTAS = [
  {
    nome: "GET /vehicles/[id]",
    permitidos: TODOS,
    chamar: () => vehicleIdRoute.GET(reqGet(`http://localhost/api/admin/vehicles/${UUID}`), ctxComId()),
  },
  {
    nome: "PUT /vehicles/[id]",
    permitidos: TODOS,
    chamar: () =>
      vehicleIdRoute.PUT(
        reqJson(`http://localhost/api/admin/vehicles/${UUID}`, "PUT", { brand: "Audi" }),
        ctxComId()
      ),
  },
  {
    nome: "PATCH /vehicles/[id] (marcar vendido / desativar / reativar)",
    permitidos: ["estoque", "financeiro", "vendedor", "secretaria", "admin"],
    chamar: () =>
      vehicleIdRoute.PATCH(
        reqJson(`http://localhost/api/admin/vehicles/${UUID}`, "PATCH", { status: "vendido" }),
        ctxComId()
      ),
  },
  {
    nome: "DELETE /vehicles/[id]",
    permitidos: TODOS,
    chamar: () => vehicleIdRoute.DELETE(reqGet(`http://localhost/api/admin/vehicles/${UUID}`), ctxComId()),
  },
];

for (const rota of ROTAS) {
  for (const papel of TODOS) {
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
  const res = await vehicleIdRoute.PATCH(
    reqJson(`http://localhost/api/admin/vehicles/${UUID}`, "PATCH", { status: "vendido" }),
    ctxComId()
  );
  assert.equal(res.status, 401);
});
