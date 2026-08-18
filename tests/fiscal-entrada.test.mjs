/**
 * A NF-e de ENTRADA, travada contra as notas 14 e 15 da própria Vamaq.
 *
 * POR QUE A ENTRADA IMPORTA: o texto obrigatório da nota de VENDA cita o número
 * da nota de ENTRADA do veículo ("VEICULO USADO ADQ DE ... CF NF 10"). Sem a
 * entrada emitida, a venda não sai — é por isso que os carros acumulam.
 *
 * OS VALORES AQUI NÃO SÃO INTERPRETAÇÃO DE LEI: saem de duas DANFEs da Vamaq
 * já autorizadas pela SEFAZ-MG (a 15, entrada por compra, e a 14, entrada por
 * consignação), documentadas em
 * docs/superpowers/specs/2026-08-12-parametros-nfe-reais.md. É a mesma regra
 * que vale para o resto do módulo: parâmetro fiscal se confirma contra nota
 * autorizada, não contra memória de conversa.
 *
 * Puro, sem banco e sem rede.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { montarPayloadEntrada } from "../src/lib/fiscal/payload.js";

// Os defaults que db/fiscal-entrada.sql grava — as notas autorizadas.
const CONFIG = {
  cnpj: "45.348.469/0001-54",
  ncm: "87032100",
  serie: "2",
  origem: "0",
  cfop_entrada: "1102",
  natureza_entrada: "Compra Dentro do Estado",
  cfop_entrada_consignacao: "1917",
  natureza_entrada_consignacao:
    "entrada de mercadoria recebida em consignacao mercantil ou industrial",
  cst_entrada: "041",
  modalidade_frete_entrada: "1",
};

const VEICULO = {
  brand: "Porsche",
  model: "Cayenne",
  year: 2016,
  placa: "PAS4I58",
  chassi: "WP1AA2923GKA14408",
};

const PESSOA_FISICA = {
  nome: "João Vendedor",
  doc: "529.982.247-25",
  cep: "38411-108",
  logradouro: "Rua Exemplo",
  numero: "10",
  bairro: "Centro",
  municipio: "Uberlândia",
  uf: "mg",
};

function monta(extra = {}) {
  return montarPayloadEntrada({
    config: CONFIG,
    veiculo: VEICULO,
    remetente: PESSOA_FISICA,
    valorAquisicao: 160000,
    ...extra,
  });
}

test("compra de pessoa física reproduz a NF 15", () => {
  const { payload, error } = monta();
  assert.equal(error, undefined, error);

  // tpNF 0 é o que diz que a mercadoria ENTRA no estabelecimento de quem emite.
  assert.equal(payload.tipo_documento, 0);
  assert.equal(payload.natureza_operacao, "Compra Dentro do Estado");
  assert.equal(payload.items[0].cfop, "1102");
  assert.equal(payload.items[0].codigo_ncm, "87032100");
  // Na entrada o frete continua 1 — diferente da saída, corrigida para 9.
  assert.equal(payload.modalidade_frete, "1");
  assert.equal(payload.serie, "2");
});

test("consignação recebida reproduz a NF 14", () => {
  const { payload, error } = monta({ consignacao: true });
  assert.equal(error, undefined, error);
  assert.equal(payload.tipo_documento, 0);
  assert.equal(payload.items[0].cfop, "1917");
  assert.match(payload.natureza_operacao, /consignacao/i);
});

test("nada de imposto é destacado — quem vendeu é pessoa física", () => {
  const { payload } = monta();
  const item = payload.items[0];
  // CST 041 chega na forma combinada (origem 0 + CST 41) e é normalizado.
  assert.equal(item.icms_situacao_tributaria, "41");
  assert.equal(item.icms_origem, "0");
  for (const campo of [
    "icms_base_calculo",
    "icms_aliquota",
    "icms_valor",
    "pis_base_calculo",
    "pis_valor",
    "cofins_base_calculo",
    "cofins_valor",
  ]) {
    assert.equal(item[campo], 0, `${campo} deveria ser zero na entrada`);
  }
});

test("IBS/CBS NÃO sai na entrada enquanto o contador não confirmar", () => {
  const { payload } = monta();
  const chaves = Object.keys(payload.items[0]).filter((k) => /ibs|cbs/.test(k));
  assert.deepEqual(
    chaves,
    [],
    "as notas 14 e 15 são anteriores à reforma e não respondem — o padrão é não destacar"
  );
});

test("comprando de EMPRESA a nota não sai — quem emite é ela", () => {
  const { error, payload } = monta({
    remetente: { ...PESSOA_FISICA, doc: "45.348.469/0001-54" },
  });
  assert.equal(payload, undefined);
  assert.match(error, /pessoa física|só recebe/i);
});

test("valor zerado é recusado antes de qualquer coisa", () => {
  assert.match(monta({ valorAquisicao: 0 }).error, /valor pago/i);
});

test("veículo sem chassi é recusado — é ele que liga entrada e saída", () => {
  assert.match(
    monta({ veiculo: { ...VEICULO, chassi: null } }).error,
    /chassi/i
  );
});

test("quem vendeu sem endereço completo é recusado, campo a campo", () => {
  for (const campo of ["nome", "cep", "logradouro", "bairro", "municipio", "uf"]) {
    const remetente = { ...PESSOA_FISICA, [campo]: "" };
    const { error } = monta({ remetente });
    assert.ok(error, `faltando ${campo} deveria recusar`);
    assert.match(error, /vendeu o veículo está sem/i);
  }
});

test("a UF vai em maiúscula e o CPF só com dígitos", () => {
  const { payload } = monta();
  assert.equal(payload.uf_destinatario, "MG");
  assert.equal(payload.cpf_destinatario, "52998224725");
  assert.equal(payload.cnpj_emitente, "45348469000154");
  assert.equal(payload.indicador_inscricao_estadual_destinatario, 9);
});

test("a descrição do item é a mesma da saída — o chassi liga as duas notas", () => {
  const { payload } = monta();
  assert.match(payload.items[0].descricao, /Porsche Cayenne 2016/);
  assert.match(payload.items[0].descricao, /Chassi WP1AA2923GKA14408/);
});
