/**
 * Cancelamento de NF-e: o endpoint certo e a justificativa dentro das regras.
 *
 * O QUE ACONTECEU (22/08/2026): a NF 17 saiu com o CFOP errado e a Mayra foi
 * cancelar. A tela respondeu "Endpoint não encontrado, verifique a
 * documentação desta API" — ela não tinha como saber que era defeito nosso e
 * não regra da SEFAZ.
 *
 * O código chamava `POST /nfe/{ref}/cancel`. Na Focus é `DELETE /nfe/{ref}`
 * com a justificativa no corpo. O endpoint inventado nunca existiu, então o
 * cancelamento NUNCA funcionou — só ninguém tinha precisado até hoje.
 *
 * A justificativa é de 15 a 255 caracteres (regra da SEFAZ). Conferir aqui faz
 * o erro sair em português, antes da viagem.
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { cancelarNfe, cartaCorrecaoNfe } from "../src/lib/fiscal/focus/client.js";

const fetchReal = globalThis.fetch;
let chamadas = [];

beforeEach(() => {
  chamadas = [];
  process.env.FOCUS_NFE_TOKEN = "token-de-teste";
  globalThis.fetch = async (url, init) => {
    chamadas.push({ url: String(url), method: init?.method, body: init?.body });
    return new Response(JSON.stringify({ status: "cancelado" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
});

afterEach(() => {
  globalThis.fetch = fetchReal;
});

test("cancela com DELETE /nfe/{ref} — não com POST /nfe/{ref}/cancel", async () => {
  await cancelarNfe("vamaq-abc", "Nota emitida com CFOP incorreto para o estado");
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].method, "DELETE");
  assert.match(chamadas[0].url, /\/v2\/nfe\/vamaq-abc$/);
  assert.doesNotMatch(chamadas[0].url, /\/cancel/);
});

test("a justificativa vai no corpo", async () => {
  const texto = "Nota emitida com CFOP incorreto para o estado";
  await cancelarNfe("vamaq-abc", texto);
  assert.deepEqual(JSON.parse(chamadas[0].body), { justificativa: texto });
});

test("justificativa curta é barrada aqui, antes da viagem", async () => {
  // Mínimo da SEFAZ é 15. "Errei" tem 5.
  await assert.rejects(
    () => cancelarNfe("vamaq-abc", "Errei"),
    /pelo menos 15 caracteres.*tem 5/s
  );
  assert.equal(chamadas.length, 0, "não pode nem chamar a API");
});

test("justificativa longa demais também", async () => {
  await assert.rejects(
    () => cancelarNfe("vamaq-abc", "A".repeat(256)),
    /máximo 255 caracteres.*tem 256/s
  );
  assert.equal(chamadas.length, 0);
});

test("exatamente 15 passa, 14 não", async () => {
  await cancelarNfe("vamaq-abc", "A".repeat(15));
  assert.equal(chamadas.length, 1);
  await assert.rejects(() => cancelarNfe("vamaq-abc", "A".repeat(14)));
});

test("espaço nas pontas não conta para o mínimo", async () => {
  // "   Errei   " tem 11 caracteres de texto: não pode passar por ter espaços.
  await assert.rejects(() => cancelarNfe("vamaq-abc", "   Errei   "), /pelo menos 15/);
});

test("a referência é escapada na URL", async () => {
  await cancelarNfe("vamaq/abc 1", "Nota emitida com CFOP incorreto para o estado");
  assert.match(chamadas[0].url, /vamaq%2Fabc%201$/);
});

// ── Carta de correção ──────────────────────────────────────────────────────
//
// A saída quando o prazo de 24 horas para cancelar venceu — o que acontece
// sempre que o erro aparece num fim de semana, como na NF 17 (23/08/2026).

test("a carta de correção vai em POST /nfe/{ref}/carta_correcao", async () => {
  await cartaCorrecaoNfe("vamaq-abc", "CFOP correto para operacao interestadual: 2917");
  assert.equal(chamadas[0].method, "POST");
  assert.match(chamadas[0].url, /\/v2\/nfe\/vamaq-abc\/carta_correcao$/);
});

test("o texto vai no campo `correcao`", async () => {
  const texto = "CFOP correto para operacao interestadual: 2917";
  await cartaCorrecaoNfe("vamaq-abc", texto);
  assert.deepEqual(JSON.parse(chamadas[0].body), { correcao: texto });
});

test("limites da carta: 15 a 1000 caracteres, conferidos antes de mandar", async () => {
  await assert.rejects(() => cartaCorrecaoNfe("r", "curto"), /pelo menos 15/);
  await assert.rejects(() => cartaCorrecaoNfe("r", "A".repeat(1001)), /máximo 1000/);
  assert.equal(chamadas.length, 0, "nenhuma das duas pode chegar a chamar a API");

  // O limite é maior que o do cancelamento (255) — são campos diferentes.
  await cartaCorrecaoNfe("r", "A".repeat(1000));
  assert.equal(chamadas.length, 1);
});
