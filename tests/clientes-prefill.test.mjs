import { test } from "node:test";
import assert from "node:assert/strict";
import {
  papelPorTemplate,
  prefixoDoTemplate,
  camposDoTemplate,
  destinatarioDoCliente,
} from "../src/lib/clientes/prefill.js";

const CLIENTE_PF = {
  nome: "Carlos Teste",
  tipo: "pf",
  doc: "12345678900",
  cnh: "01234567890",
  cnh_categoria: "B",
  telefone: "(34) 99999-0000",
  email: "carlos@exemplo.com",
  logradouro: "Rua das Flores",
  numero: "120",
  bairro: "Centro",
  municipio: "Uberlândia",
  uf: "MG",
  // O repositório normaliza CEP para só dígitos antes de gravar (ver
  // repo.js/campos.js) — "38400-100" nunca chega assim vindo do banco. Este
  // fixture reflete o dado real; a máscara "38400-100" na linha de endereço
  // é aplicada na saída por enderecoEmUmaLinha (ver clientes-endereco.test.mjs).
  cep: "38400100",
};

const CLIENTE_PJ = {
  nome: "Transportes Teste LTDA",
  tipo: "pj",
  doc: "12345678000190",
  representante_nome: "Ana Representante",
  representante_cpf: "98765432100",
  municipio: "Uberlândia",
  uf: "MG",
};

test("papelPorTemplate mapeia cada modelo", () => {
  assert.equal(papelPorTemplate("compra-venda"), "vendeu");
  assert.equal(papelPorTemplate("venda"), "comprou");
  assert.equal(papelPorTemplate("consignacao"), "consignou");
  assert.equal(papelPorTemplate("termo-vistoria"), "consignou");
});

test("papelPorTemplate devolve null para modelo desconhecido ou vazio", () => {
  assert.equal(papelPorTemplate("outro-qualquer"), null);
  assert.equal(papelPorTemplate(""), null);
  assert.equal(papelPorTemplate(null), null);
});

test("prefixoDoTemplate devolve o prefixo dos campos daquele modelo", () => {
  assert.equal(prefixoDoTemplate("compra-venda"), "vendedor");
  assert.equal(prefixoDoTemplate("venda"), "comprador");
  assert.equal(prefixoDoTemplate("consignacao"), "proprietario");
  assert.equal(prefixoDoTemplate("termo-vistoria"), "proprietario");
  assert.equal(prefixoDoTemplate("outro-qualquer"), null);
});

test("compra-venda preenche a ficha do vendedor", () => {
  const campos = camposDoTemplate("compra-venda", CLIENTE_PF);
  assert.equal(campos.vendedor_nome, "Carlos Teste");
  assert.equal(campos.vendedor_cpf, "123.456.789-00");
  assert.equal(campos.vendedor_cnh, "01234567890");
  assert.equal(campos.vendedor_cnh_categoria, "B");
  assert.equal(campos.vendedor_telefone, "(34) 99999-0000");
  assert.equal(campos.vendedor_email, "carlos@exemplo.com");
  assert.equal(
    campos.vendedor_endereco,
    "Rua das Flores, 120, Centro, Uberlândia/MG, CEP 38400-100"
  );
});

test("venda preenche a ficha do comprador", () => {
  const campos = camposDoTemplate("venda", CLIENTE_PF);
  assert.equal(campos.comprador_nome, "Carlos Teste");
  assert.equal(campos.comprador_cpf, "123.456.789-00");
  assert.equal(campos.comprador_telefone, "(34) 99999-0000");
  assert.ok(campos.comprador_endereco.includes("Uberlândia/MG"));
});

test("venda para PJ leva o representante junto", () => {
  const campos = camposDoTemplate("venda", CLIENTE_PJ);
  assert.equal(campos.comprador_nome, "Transportes Teste LTDA");
  assert.equal(campos.comprador_cpf, "12.345.678/0001-90");
  assert.equal(campos.comprador_representante_nome, "Ana Representante");
  assert.equal(campos.comprador_representante_cpf, "987.654.321-00");
});

test("PF não recebe campos de representante", () => {
  const campos = camposDoTemplate("venda", CLIENTE_PF);
  assert.equal("comprador_representante_nome" in campos, false);
});

test("consignacao e termo-vistoria preenchem a ficha do proprietário", () => {
  const consig = camposDoTemplate("consignacao", CLIENTE_PF);
  assert.equal(consig.proprietario_nome, "Carlos Teste");
  assert.equal(consig.proprietario_cpf, "123.456.789-00");
  assert.equal(consig.proprietario_cnh_categoria, "B");

  const vistoria = camposDoTemplate("termo-vistoria", CLIENTE_PF);
  assert.equal(vistoria.proprietario_nome, "Carlos Teste");
  assert.equal(vistoria.proprietario_telefone, "(34) 99999-0000");
});

test("campos vazios do cliente não entram no objeto", () => {
  const campos = camposDoTemplate("compra-venda", { nome: "Só o Nome" });
  assert.equal(campos.vendedor_nome, "Só o Nome");
  assert.equal("vendedor_cnh" in campos, false);
  assert.equal("vendedor_endereco" in campos, false);
});

test("modelo desconhecido e cliente nulo devolvem objeto vazio", () => {
  assert.deepEqual(camposDoTemplate("outro-qualquer", CLIENTE_PF), {});
  assert.deepEqual(camposDoTemplate("venda", null), {});
});

test("destinatarioDoCliente monta o destinatário da NF-e", () => {
  assert.deepEqual(destinatarioDoCliente(CLIENTE_PF), {
    nome: "Carlos Teste",
    doc: "12345678900",
    cep: "38400100",
    logradouro: "Rua das Flores",
    numero: "120",
    bairro: "Centro",
    municipio: "Uberlândia",
    uf: "MG",
  });
});

test("destinatarioDoCliente sem endereço devolve os campos vazios, não undefined", () => {
  const d = destinatarioDoCliente({ nome: "Sem Endereço", doc: "12345678900" });
  assert.equal(d.logradouro, "");
  assert.equal(d.uf, "");
  assert.equal(d.nome, "Sem Endereço");
});

test("destinatarioDoCliente com cliente nulo devolve todos os campos vazios", () => {
  const d = destinatarioDoCliente(null);
  assert.equal(d.nome, "");
  assert.equal(d.doc, "");
});
