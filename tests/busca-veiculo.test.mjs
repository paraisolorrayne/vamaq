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

// --- Chassi (14/08/2026) -----------------------------------------------
// A proposta prometeu "busca por placa, chassi ou período" e o chassi tinha
// ficado de fora do filtro da lista do Estoque. É o identificador que
// sobrevive à troca de placa — e o que a nota fiscal e o contrato usam.

test("chassi é encontrado do jeito que a pessoa digita", () => {
  const alvo = "9BWZZZ377VT004251";
  const campo = `Chevrolet S10 PRETA ABC1D23 ${alvo}`;
  for (const digitado of [alvo, alvo.toLowerCase(), "9bwzzz 377 vt004251", "9BWZZZ377VT004251 "]) {
    assert.ok(
      normalizaBusca(campo).includes(normalizaBusca(digitado)),
      `não achou com "${digitado}"`
    );
  }
});

test("busca por pedaço final do chassi funciona", () => {
  // Como a pessoa costuma conferir: os últimos dígitos.
  const campo = normalizaBusca("Chevrolet S10 PRETA ABC1D23 9BWZZZ377VT004251");
  assert.ok(campo.includes(normalizaBusca("004251")));
});

test("chassi de um carro não acha outro", () => {
  const a = normalizaBusca("Audi Q3 Cinza RMJ1A24 WAUBYAF35M1054156");
  assert.ok(!a.includes(normalizaBusca("9BWZZZ377VT004251")));
});
