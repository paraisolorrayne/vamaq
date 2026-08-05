/**
 * Montagem do payload da NF-e. Puro — sem banco, sem rede.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { montarPayloadNfe } from "../src/lib/fiscal/payload.js";

const CONFIG = {
  cnpj: "45348469000154", ie: "00548033300093", im: "73753300",
  cfop: "5102", cst: "000", ncm: "87032310", serie: "1",
  icms_seminovo_aliquota: 5,
};
const VEICULO = {
  brand: "Audi", model: "Q5", year: 2022, placa: "ABC1D23",
  chassi: "9BWZZZ377VT004251",
};
const DESTINATARIO = {
  nome: "João Comprador", doc: "52998224725",
  cep: "32000000", logradouro: "Rua das Flores", numero: "100",
  bairro: "Centro", municipio: "Contagem", uf: "MG",
};

function args(over = {}) {
  return {
    config: CONFIG, veiculo: VEICULO, destinatario: DESTINATARIO,
    valorVenda: 200000, custoAquisicao: 150000, ...over,
  };
}

test("monta o payload com emitente, destinatário e um item", () => {
  const { payload, error } = montarPayloadNfe(args());
  assert.equal(error, undefined);
  assert.equal(payload.cnpj_emitente, "45348469000154");
  assert.equal(payload.natureza_operacao, "Venda de mercadoria");
  assert.equal(payload.nome_destinatario, "João Comprador");
  assert.equal(payload.cpf_destinatario, "52998224725");
  assert.equal(payload.uf_destinatario, "MG");
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].codigo_ncm, "87032310");
  assert.equal(payload.items[0].cfop, "5102");
  assert.equal(payload.items[0].valor_unitario_comercial, 200000);
});

test("a descrição do item identifica o carro, com placa e chassi", () => {
  const { payload } = montarPayloadNfe(args());
  const d = payload.items[0].descricao;
  assert.match(d, /Audi/);
  assert.match(d, /Q5/);
  assert.match(d, /2022/);
  assert.match(d, /ABC1D23/);
  assert.match(d, /9BWZZZ377VT004251/);
});

test("ICMS do seminovo: base é o lucro, não o valor da venda", () => {
  const { impostos, payload } = montarPayloadNfe(args());
  assert.equal(impostos.base, 50000);      // 200000 - 150000
  assert.equal(impostos.aliquota, 5);
  assert.equal(impostos.icms, 2500);       // 5% de 50000
  assert.equal(payload.items[0].icms_base_calculo, 50000);
  assert.equal(payload.items[0].icms_valor, 2500);
});

test("venda abaixo do custo não gera ICMS negativo", () => {
  const { impostos } = montarPayloadNfe(args({ valorVenda: 140000 }));
  assert.equal(impostos.base, 0);
  assert.equal(impostos.icms, 0);
});

test("CNPJ no destinatário vai no campo de CNPJ, não no de CPF", () => {
  const { payload } = montarPayloadNfe(
    args({ destinatario: { ...DESTINATARIO, doc: "45348469000154" } })
  );
  assert.equal(payload.cnpj_destinatario, "45348469000154");
  assert.equal(payload.cpf_destinatario, undefined);
});

test("recusa quando falta chassi", () => {
  const { error } = montarPayloadNfe(
    args({ veiculo: { ...VEICULO, chassi: "" } })
  );
  assert.match(error, /chassi/i);
});

test("recusa quando o endereço do destinatário está incompleto", () => {
  const { error } = montarPayloadNfe(
    args({ destinatario: { ...DESTINATARIO, municipio: "" } })
  );
  assert.match(error, /município/i);
});

test("recusa quando falta parâmetro fiscal do contador", () => {
  const { error } = montarPayloadNfe(
    args({ config: { ...CONFIG, cfop: "" } })
  );
  assert.match(error, /CFOP/i);
});

test("recusa valor de venda ausente ou zero", () => {
  assert.match(montarPayloadNfe(args({ valorVenda: 0 })).error, /valor da venda/i);
});
