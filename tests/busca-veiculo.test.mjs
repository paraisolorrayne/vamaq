/**
 * Normalização da busca de veículo. Pura — sem banco, sem rede.
 *
 * A placa é o motivo desta função existir: a pessoa digita ABC-1D23, abc1d23
 * ou ABC 1D23 e tem que achar o mesmo carro.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizaBusca } from "../src/lib/buscaVeiculo.js";

test("ignora maiúsculas", () => {
  assert.equal(normalizaBusca("ABC1D23"), "abc1d23");
});

test("descarta hífen, espaço e ponto", () => {
  assert.equal(normalizaBusca("ABC-1D23"), "abc1d23");
  assert.equal(normalizaBusca("ABC 1D23"), "abc1d23");
  assert.equal(normalizaBusca("A.B.C-1D23"), "abc1d23");
});

test("as três formas de digitar a placa dão no mesmo", () => {
  const formas = ["ABC-1D23", "abc 1d23", "ABC1D23"];
  const [primeira, ...resto] = formas.map(normalizaBusca);
  for (const f of resto) assert.equal(f, primeira);
});

test("preserva letras e números de marca e modelo", () => {
  assert.equal(normalizaBusca("Audi Q5"), "audiq5");
  assert.equal(normalizaBusca("320i"), "320i");
});

test("aguenta vazio, nulo e indefinido", () => {
  assert.equal(normalizaBusca(""), "");
  assert.equal(normalizaBusca(null), "");
  assert.equal(normalizaBusca(undefined), "");
});
