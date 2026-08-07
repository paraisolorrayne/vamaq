/**
 * Matriz de autorização das rotas de cliente (src/app/api/admin/clientes/).
 *
 * A promessa central desta entrega é que o vendedor LÊ a lista de clientes
 * (para o seletor de contrato/NF-e) mas não escreve, e nem lê a ficha
 * completa — ela carrega notas fiscais (ver o comentário em
 * src/app/api/admin/clientes/[id]/route.js). Um defeito real nessa fronteira
 * passou por seis revisões e só foi pego na revisão da branch inteira; este
 * é o teste que teria pego na hora.
 *
 * Como isolamos a sessão sem tocar em código de produção nem no
 * package.json — as opções investigadas:
 *
 *   1. `mock.module` do node:test (Node 22+) precisa da flag de CLI
 *      `--experimental-test-module-mocks`. Confirmado que essa flag NÃO
 *      pode ser passada via NODE_OPTIONS ("is not allowed in NODE_OPTIONS"),
 *      então só entraria mudando o script `test` do package.json — proibido
 *      pela tarefa.
 *
 *   2. Importar as rotas direto com o alias "@/" não resolve em `node
 *      --test` (mesma razão de repo.js ser intestável hoje). E mesmo se
 *      resolvesse, `readSessionUser` chama `cookies()` de "next/headers",
 *      que lança "called outside a request scope" fora do runtime do
 *      Next — não dá pra chamar o módulo de sessão de verdade aqui, mockado
 *      ou não.
 *
 *   3. A escolhida: `node:module`'s `register()` (API estável, sem flag de
 *      CLI, chamada em runtime pelo próprio teste) para registrar um hook de
 *      carregamento que (a) resolve o alias "@/" para src/, (b) completa a
 *      extensão de "next/server"/"next/headers" que o import sem extensão
 *      não acha, e (c) troca só "@/lib/auth/session" por um módulo falso que
 *      lê `globalThis.__TEST_SESSION_USER__` em vez de chamar `cookies()`.
 *      Os handlers de rota testados são os de verdade — só o que fica atrás
 *      de `readSessionUser` é falso. Ver tests/helpers/mock-session-loader.mjs.
 *
 * O banco não é mockado: sem DATABASE_URL no ambiente de teste, `query()`
 * (src/lib/db.js) devolve `{rows: []}` em vez de lançar — então os casos
 * permitidos passam da guarda e continuam para 200/400/404, nunca 403. Só
 * verificamos "não é 403" para quem pode, e "é 403" para quem não pode.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./tests/helpers/mock-session-loader.mjs", pathToFileURL("./"));

import { test } from "node:test";
import assert from "node:assert/strict";

const UUID = "00000000-0000-0000-0000-000000000000";

const clientesRoute = await import("../src/app/api/admin/clientes/route.js");
const clienteIdRoute = await import("../src/app/api/admin/clientes/[id]/route.js");
const veiculosRoute = await import("../src/app/api/admin/clientes/[id]/veiculos/route.js");

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

// Uma linha por handler das rotas de cliente. `permitidos` é a matriz do
// enunciado — o teste abaixo varre os cinco papéis contra cada linha.
const ROTAS = [
  {
    nome: "GET /clientes",
    permitidos: ["secretaria", "financeiro", "vendedor", "admin"],
    chamar: () => clientesRoute.GET(reqGet("http://localhost/api/admin/clientes")),
  },
  {
    nome: "POST /clientes",
    permitidos: ["secretaria", "financeiro", "admin"],
    chamar: () =>
      clientesRoute.POST(
        reqJson("http://localhost/api/admin/clientes", "POST", { nome: "Fulano de Teste" })
      ),
  },
  {
    // Vendedor de propósito FORA de permitidos: a ficha carrega notas
    // fiscais, e a lista (GET /clientes) já é o que o vendedor usa.
    nome: "GET /clientes/[id]",
    permitidos: ["secretaria", "financeiro", "admin"],
    chamar: () =>
      clienteIdRoute.GET(reqGet(`http://localhost/api/admin/clientes/${UUID}`), ctxComId()),
  },
  {
    nome: "PUT /clientes/[id]",
    permitidos: ["secretaria", "financeiro", "admin"],
    chamar: () =>
      clienteIdRoute.PUT(
        reqJson(`http://localhost/api/admin/clientes/${UUID}`, "PUT", { nome: "Fulano Editado" }),
        ctxComId()
      ),
  },
  {
    nome: "PATCH /clientes/[id]",
    permitidos: ["secretaria", "financeiro", "admin"],
    chamar: () =>
      clienteIdRoute.PATCH(
        reqJson(`http://localhost/api/admin/clientes/${UUID}`, "PATCH", { ativo: false }),
        ctxComId()
      ),
  },
  {
    nome: "POST /clientes/[id]/veiculos",
    permitidos: ["secretaria", "financeiro", "admin"],
    chamar: () =>
      veiculosRoute.POST(
        reqJson(`http://localhost/api/admin/clientes/${UUID}/veiculos`, "POST", {
          vehicleId: UUID,
          papel: "comprou",
        }),
        ctxComId()
      ),
  },
  {
    nome: "DELETE /clientes/[id]/veiculos",
    permitidos: ["secretaria", "financeiro", "admin"],
    chamar: () =>
      veiculosRoute.DELETE(
        reqGet(`http://localhost/api/admin/clientes/${UUID}/veiculos?vinculoId=${UUID}`),
        ctxComId()
      ),
  },
];

// admin sempre passa (requireApiRole libera antes de olhar a lista de
// papéis) — incluído mesmo assim na varredura para provar isso também.
const PAPEIS = ["secretaria", "financeiro", "vendedor", "admin", "estoque"];

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
  const res = await clientesRoute.GET(reqGet("http://localhost/api/admin/clientes"));
  assert.equal(res.status, 401);
});
