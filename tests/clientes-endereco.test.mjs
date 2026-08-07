import { test } from "node:test";
import assert from "node:assert/strict";
import { enderecoEmUmaLinha } from "../src/lib/clientes/endereco.js";

test("endereço completo vira uma linha legível, com o CEP mascarado", () => {
  const linha = enderecoEmUmaLinha({
    logradouro: "Rua das Flores",
    numero: "120",
    complemento: "sala 3",
    bairro: "Centro",
    municipio: "Uberlândia",
    uf: "MG",
    cep: "38400100",
  });
  assert.equal(linha, "Rua das Flores, 120, sala 3, Centro, Uberlândia/MG, CEP 38400-100");
});

test("CEP com tamanho estranho sai sem máscara, do jeito que veio", () => {
  const linha = enderecoEmUmaLinha({
    municipio: "Uberlândia",
    uf: "MG",
    cep: "384001",
  });
  assert.equal(linha, "Uberlândia/MG, CEP 384001");
});

test("partes vazias somem sem deixar vírgula solta", () => {
  const linha = enderecoEmUmaLinha({
    logradouro: "Rua das Flores",
    numero: "120",
    municipio: "Uberlândia",
    uf: "MG",
  });
  assert.equal(linha, "Rua das Flores, 120, Uberlândia/MG");
});

test("só município e UF", () => {
  assert.equal(enderecoEmUmaLinha({ municipio: "Uberlândia", uf: "MG" }), "Uberlândia/MG");
});

test("município sem UF, e UF sem município", () => {
  assert.equal(enderecoEmUmaLinha({ municipio: "Uberlândia" }), "Uberlândia");
  assert.equal(enderecoEmUmaLinha({ uf: "MG" }), "MG");
});

test("cliente vazio, null e sem nenhum campo de endereço devolvem string vazia", () => {
  assert.equal(enderecoEmUmaLinha({}), "");
  assert.equal(enderecoEmUmaLinha(null), "");
  assert.equal(enderecoEmUmaLinha({ nome: "Fulano" }), "");
});

test("espaços em branco não contam como preenchido", () => {
  assert.equal(enderecoEmUmaLinha({ logradouro: "   ", municipio: "Uberlândia" }), "Uberlândia");
});
