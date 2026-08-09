import { test } from "node:test";
import assert from "node:assert/strict";
import { mensagemWhatsapp, linkWhatsapp } from "../src/lib/crm/whatsappVendedor.js";
import { telefoneWhatsapp } from "../src/lib/crm/telefone.js";

const VEICULO = { vehicle_brand: "Toyota", vehicle_model: "Corolla", vehicle_year: 2021 };
const TELEFONE = "34999887766";

test("nome vazio: saudação genérica, sem vírgula nem nome", () => {
  assert.equal(mensagemWhatsapp({ cliente_nome: "" }), "Olá! Aqui é da Vamaq Motors, tudo bem? Vamos continuar o seu atendimento.");
});

test("nome ausente (undefined/null): mesma saudação genérica", () => {
  assert.equal(mensagemWhatsapp({}), "Olá! Aqui é da Vamaq Motors, tudo bem? Vamos continuar o seu atendimento.");
  assert.equal(mensagemWhatsapp({ cliente_nome: null }), "Olá! Aqui é da Vamaq Motors, tudo bem? Vamos continuar o seu atendimento.");
});

test("nome só com espaços: trata como vazio, saudação genérica", () => {
  assert.equal(mensagemWhatsapp({ cliente_nome: "   " }), "Olá! Aqui é da Vamaq Motors, tudo bem? Vamos continuar o seu atendimento.");
});

test("nome com espaços à frente: usa o primeiro nome depois do trim", () => {
  assert.equal(
    mensagemWhatsapp({ cliente_nome: "   Maria Silva" }),
    "Olá, Maria! Aqui é da Vamaq Motors, tudo bem? Vamos continuar o seu atendimento."
  );
});

test("nome composto: usa só o primeiro nome", () => {
  assert.equal(
    mensagemWhatsapp({ cliente_nome: "João da Silva Santos" }),
    "Olá, João! Aqui é da Vamaq Motors, tudo bem? Vamos continuar o seu atendimento."
  );
});

test("nomes separados por espaço múltiplo (tabs/duplo espaço): mesmo assim pega o primeiro", () => {
  assert.equal(
    mensagemWhatsapp({ cliente_nome: "Pedro   Alves" }),
    "Olá, Pedro! Aqui é da Vamaq Motors, tudo bem? Vamos continuar o seu atendimento."
  );
});

test("com veículo vinculado: menciona o veículo e pergunta se pode continuar", () => {
  const o = { cliente_nome: "Ana", ...VEICULO };
  assert.equal(
    mensagemWhatsapp(o),
    "Olá, Ana! Aqui é da Vamaq Motors, sobre o Toyota Corolla 2021 que você está negociando com a gente — podemos continuar?"
  );
});

test("sem veículo vinculado: mensagem genérica de continuidade de atendimento", () => {
  const o = { cliente_nome: "Ana" };
  assert.equal(
    mensagemWhatsapp(o),
    "Olá, Ana! Aqui é da Vamaq Motors, tudo bem? Vamos continuar o seu atendimento."
  );
});

test("linkWhatsapp: usa o telefone normalizado (DDI 55) e a mensagem codificada em ?text=", () => {
  const o = { cliente_nome: "Ana", telefone: TELEFONE, ...VEICULO };
  const link = linkWhatsapp(o);
  const numeroEsperado = telefoneWhatsapp(TELEFONE);
  const textoEsperado = encodeURIComponent(mensagemWhatsapp(o));
  assert.equal(link, `https://wa.me/${numeroEsperado}?text=${textoEsperado}`);
});

test("linkWhatsapp: espaço e vírgula da mensagem saem escapados (%20/%2C), não soltos na URL", () => {
  const o = { cliente_nome: "Ana", telefone: TELEFONE };
  const link = linkWhatsapp(o);
  const texto = link.split("?text=")[1];
  assert.ok(!texto.includes(" "), "espaço não deveria sobrar sem codificar");
  assert.ok(!texto.includes(","), "vírgula não deveria sobrar sem codificar");
  assert.ok(texto.includes("%20"), "espaço deveria estar como %20");
  assert.ok(texto.includes("%2C"), "vírgula deveria estar como %2C");
});
