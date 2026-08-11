/**
 * Montagem do payload da NF-e. Puro — sem banco, sem rede.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { montarPayloadNfe, normalizaCstIcms } from "../src/lib/fiscal/payload.js";
import { mensagemDeErro } from "../src/lib/fiscal/focus/client.js";

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

test("payload traz os três campos estruturais exigidos pela Focus", () => {
  const { payload } = montarPayloadNfe(args());
  assert.equal(payload.tipo_documento, 1);
  assert.equal(payload.finalidade_emissao, 1);
  assert.ok(payload.data_emissao, "data_emissao ausente");
  assert.doesNotThrow(() => new Date(payload.data_emissao).toISOString());
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

test("recusa CPF/CNPJ do destinatário com tamanho inválido", () => {
  const { error } = montarPayloadNfe(
    args({ destinatario: { ...DESTINATARIO, doc: "123456789012" } }) // 12 dígitos
  );
  assert.match(error, /CPF\/CNPJ.*inválido/i);
});

test("base do ICMS não carrega ponto flutuante sujo (arredonda para 2 casas)", () => {
  const { payload, impostos } = montarPayloadNfe(
    args({ valorVenda: 100000.1, custoAquisicao: 50000.001 })
  );
  const casasDecimais = (n) => (String(n).split(".")[1] || "").length;
  assert.ok(casasDecimais(payload.items[0].icms_base_calculo) <= 2);
  assert.ok(casasDecimais(impostos.base) <= 2);
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

// --- CST do ICMS: dois dígitos, com a origem em campo próprio ---
// Em 11/08/2026 a Mayra tentou emitir e a SEFAZ recusou com
// "Situacao tributaria (ICMS) invalida: 020". O contador passou "020", que é a
// forma combinada (origem 0 + CST 20) — a que aparece na DANFE. Foi gravada
// inteira no campo do CST, e a origem ainda ia separada, duplicada.

test("CST de dois dígitos passa como está", () => {
  assert.deepEqual(normalizaCstIcms("20", "0"), { cst: "20" });
  assert.deepEqual(normalizaCstIcms("00", "0"), { cst: "00" });
});

test("CST combinado perde o dígito da origem", () => {
  // o caso real que quebrou
  assert.deepEqual(normalizaCstIcms("020", "0"), { cst: "20" });
  assert.deepEqual(normalizaCstIcms("100", "1"), { cst: "00" });
});

test("CST combinado que contradiz a origem é recusado, não adivinhado", () => {
  const r = normalizaCstIcms("020", "1");
  assert.ok(r.error, "deveria recusar quando origem do CST difere da cadastrada");
  assert.match(r.error, /origem/i);
  assert.equal(r.cst, undefined);
});

test("CST sem formato de situação tributária é recusado", () => {
  for (const ruim of ["", "2", "0200", "abc", null, undefined]) {
    const r = normalizaCstIcms(ruim, "0");
    assert.ok(r.error, `deveria recusar ${JSON.stringify(ruim)}`);
  }
});

test("o payload manda o CST de dois dígitos, e a origem à parte", () => {
  const r = montarPayloadNfe({
    config: { cnpj: "45348469000154", cfop: "5102", cst: "020", origem: "0", ncm: "87032100", serie: "1" },
    veiculo: { brand: "Porsche", model: "Cayenne", year: 2016, placa: "PAS4I58", chassi: "WP1AA2923GKA14408" },
    destinatario: { nome: "Fulano", doc: "11122233344", cep: "38400100", logradouro: "Rua A", numero: "1", bairro: "Centro", municipio: "Uberlândia", uf: "MG" },
    valorVenda: 175000,
    custoAquisicao: 165000,
  });
  assert.ok(!r.error, r.error);
  const item = r.payload.items[0];
  assert.equal(item.icms_situacao_tributaria, "20", 'o campo do CST não pode levar a origem junto');
  assert.equal(item.icms_origem, "0");
  assert.equal(item.icms_base_calculo, 10000);
  assert.equal(item.icms_valor, 500);
});

test("CST que não existe no regime normal é barrado aqui, não na SEFAZ", () => {
  const r = montarPayloadNfe({
    config: { cnpj: "45348469000154", cfop: "5102", cst: "99", origem: "0", ncm: "87032100", serie: "1" },
    veiculo: { brand: "X", model: "Y", year: 2020, chassi: "ABC" },
    destinatario: { nome: "F", doc: "11122233344", cep: "38400100", logradouro: "R", numero: "1", bairro: "C", municipio: "U", uf: "MG" },
    valorVenda: 1000,
    custoAquisicao: 500,
  });
  assert.ok(r.error);
  assert.match(r.error, /contador/i);
});

// --- Mensagem de erro da Focus: a curta sozinha não basta ---
// Em 11/08/2026 a recusa veio como "Erro na validação do Schema XML, verifique
// o detalhamento dos erros" — e o detalhamento era descartado pelo cliente.

test("junta a mensagem curta com o detalhamento", () => {
  const m = mensagemDeErro(
    { mensagem: "Erro na validação do Schema XML", erros: [{ campo: "icms", mensagem: "modBC ausente" }] },
    422
  );
  assert.match(m, /Schema XML/);
  assert.match(m, /modBC ausente/, "o detalhamento não pode sumir");
});

test("detalhamento como lista de strings também aparece", () => {
  const m = mensagemDeErro({ erros: ["campo A inválido", "campo B ausente"] }, 422);
  assert.match(m, /campo A inválido/);
  assert.match(m, /campo B ausente/);
});

test("só a mensagem curta, sem detalhamento", () => {
  assert.equal(mensagemDeErro({ mensagem: "Token inválido" }, 401), "Token inválido");
});

test("resposta sem nada aproveitável cai no status HTTP", () => {
  assert.match(mensagemDeErro({}, 500), /500/);
  assert.match(mensagemDeErro(null, 502), /502/);
});
