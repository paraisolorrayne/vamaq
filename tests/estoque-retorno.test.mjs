/**
 * Quando um carro vendido pode voltar ao estoque.
 *
 * O PEDIDO (Mayra, 17/09/2026, por áudio): um carro que o Mateus vendeu voltou
 * na troca de outro, e "pra ele poder aparecer aqui no estoque, tá como vendido,
 * não tem como eu voltar — vou ter que fazer um novo cadastro desse veículo".
 *
 * Só `vendido` volta: `disponivel` e `reservado` nunca saíram, e `inativo` tem o
 * caminho próprio (Reativar), que NÃO abre ciclo novo — desativar não é vender.
 *
 *   npm test   (função pura, sem banco)
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { podeRetornarAoEstoque } from "../src/lib/estoque/retornoVeiculo.js";

test("carro vendido pode voltar ao estoque", () => {
  assert.equal(podeRetornarAoEstoque({ status: "vendido" }), true);
});

test("carro disponível não volta — ele nunca saiu", () => {
  assert.equal(podeRetornarAoEstoque({ status: "disponivel" }), false);
});

test("carro reservado não volta — ele nunca saiu", () => {
  assert.equal(podeRetornarAoEstoque({ status: "reservado" }), false);
});

test("carro inativo não volta por aqui — o caminho dele é Reativar", () => {
  assert.equal(podeRetornarAoEstoque({ status: "inativo" }), false);
});

test("sem veículo não dá para decidir nada", () => {
  assert.equal(podeRetornarAoEstoque(null), false);
  assert.equal(podeRetornarAoEstoque(undefined), false);
});

test("status desconhecido não volta", () => {
  assert.equal(podeRetornarAoEstoque({ status: "qualquer_coisa" }), false);
  assert.equal(podeRetornarAoEstoque({}), false);
});
