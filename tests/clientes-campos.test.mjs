/**
 * Validação e normalização dos campos do cadastro de cliente (campos.js).
 * Puro — não toca banco. A checagem de documento duplicado fica em repo.js
 * e não é coberta aqui (precisa do pool, ver clientes-schema.test.mjs).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { prepararCampos } from "../src/lib/clientes/campos.js";

test("documento com pontuação vira só dígitos", () => {
  const { values } = prepararCampos({ nome: "Fulano", doc: "123.456.789-00" });
  assert.equal(values.doc, "12345678900");
});

test("CEP com traço vira só dígitos", () => {
  const { values } = prepararCampos({ nome: "Fulano", cep: "38400-100" });
  assert.equal(values.cep, "38400100");
});

test("representante_cpf normalizado", () => {
  const { values } = prepararCampos({
    nome: "Transportes LTDA",
    representante_cpf: "987.654.321-00",
  });
  assert.equal(values.representante_cpf, "98765432100");
});

test("uf minúscula vira maiúscula", () => {
  const { values } = prepararCampos({ nome: "Fulano", uf: "mg" });
  assert.equal(values.uf, "MG");
});

test("uf com três letras é cortada em duas", () => {
  const { values } = prepararCampos({ nome: "Fulano", uf: "mga" });
  assert.equal(values.uf, "MG");
});

test("tipo derivado do documento sobrepõe o que o formulário mandou", () => {
  // CNPJ de 14 dígitos, mas o formulário mandou tipo "pf" — o documento manda.
  const { values } = prepararCampos({
    nome: "Transportes LTDA",
    tipo: "pf",
    doc: "12345678000190",
  });
  assert.equal(values.tipo, "pj");
});

test("tipo derivado do documento também sobrepõe pj -> pf", () => {
  const { values } = prepararCampos({
    nome: "Fulano",
    tipo: "pj",
    doc: "12345678900",
  });
  assert.equal(values.tipo, "pf");
});

test("sem documento, vale o tipo do formulário", () => {
  assert.equal(prepararCampos({ nome: "Fulano", tipo: "pj" }).values.tipo, "pj");
});

test("tipo fora de pf/pj cai no padrão (pf)", () => {
  const { values } = prepararCampos({ nome: "Fulano", tipo: "xx" });
  assert.equal(values.tipo, "pf");
});

test("tipo ausente cai no padrão (pf)", () => {
  const { values } = prepararCampos({ nome: "Fulano" });
  assert.equal(values.tipo, "pf");
});

test("nome vazio, só espaços ou ausente vira {error}", () => {
  assert.equal(prepararCampos({ nome: "" }).error, "Nome é obrigatório.");
  assert.equal(prepararCampos({ nome: "   " }).error, "Nome é obrigatório.");
  assert.equal(prepararCampos({}).error, "Nome é obrigatório.");
});

test("documento com tamanho inválido vira {error}", () => {
  const { error } = prepararCampos({ nome: "Fulano", doc: "123456" });
  assert.equal(error, "CPF/CNPJ deve ter 11 ou 14 dígitos.");
});

test("documento vazio é aceito (cliente sem documento)", () => {
  const { values } = prepararCampos({ nome: "Fulano", doc: "" });
  assert.equal(values.doc, null);
});

test("campo não-string (número, array) não quebra", () => {
  const { values } = prepararCampos({
    nome: "Fulano",
    rg: 123456,
    cnh: ["01234567890"],
    telefone: 3499990000,
  });
  assert.equal(values.rg, "123456");
  assert.equal(values.cnh, "01234567890");
  assert.equal(values.telefone, "3499990000");
});

test("campos opcionais vazios viram null, não string vazia", () => {
  const { values } = prepararCampos({ nome: "Fulano" });
  assert.equal(values.doc, null);
  assert.equal(values.rg, null);
  assert.equal(values.cnh, null);
  assert.equal(values.cnh_categoria, null);
  assert.equal(values.email, null);
  assert.equal(values.telefone, null);
  assert.equal(values.cep, null);
  assert.equal(values.logradouro, null);
  assert.equal(values.numero, null);
  assert.equal(values.complemento, null);
  assert.equal(values.bairro, null);
  assert.equal(values.municipio, null);
  assert.equal(values.uf, null);
  assert.equal(values.representante_nome, null);
  assert.equal(values.representante_cpf, null);
  assert.equal(values.obs, null);
});

test("email é normalizado para minúsculas", () => {
  const { values } = prepararCampos({ nome: "Fulano", email: "Fulano@Exemplo.COM" });
  assert.equal(values.email, "fulano@exemplo.com");
});
