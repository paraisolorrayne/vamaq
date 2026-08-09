import { test } from "node:test";
import assert from "node:assert/strict";
import { valorDaOportunidade } from "../src/lib/crm/valor.js";

test("formato brasileiro com milhar e centavos vira número", () => {
  assert.equal(valorDaOportunidade("180.000,00"), 180000);
  assert.equal(valorDaOportunidade("1.234,56"), 1234.56);
});

test("número já sem formatação continua funcionando", () => {
  assert.equal(valorDaOportunidade("180000"), 180000);
});

test("vazio, null e undefined viram null — valor é campo opcional, não zero", () => {
  assert.equal(valorDaOportunidade(""), null);
  assert.equal(valorDaOportunidade(null), null);
  assert.equal(valorDaOportunidade(undefined), null);
});

test("zero é um valor válido (vale zero reais) — não vira null", () => {
  assert.equal(valorDaOportunidade(0), 0);
  assert.equal(valorDaOportunidade("0"), 0);
});

test("entrada que não dá número vira null, nunca NaN", () => {
  const v = valorDaOportunidade("abc");
  assert.equal(v, null);
  assert.ok(!Number.isNaN(v));
});

test("resultado nunca é NaN, nem para entradas maliciosas", () => {
  assert.ok(!Number.isNaN(valorDaOportunidade("180.000,00")));
  assert.ok(!Number.isNaN(valorDaOportunidade("abc")));
  assert.ok(!Number.isNaN(valorDaOportunidade("R$ ")));
  assert.ok(!Number.isNaN(valorDaOportunidade(null)));
});
