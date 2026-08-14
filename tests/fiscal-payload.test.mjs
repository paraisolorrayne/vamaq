/**
 * Montagem do payload da NF-e. Puro — sem banco, sem rede.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  montarPayloadNfe,
  normalizaCstIcms,
  textoInformacoesComplementares,
} from "../src/lib/fiscal/payload.js";
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
    valorVenda: 200000, custoAquisicao: 150000, numeroNotaEntrada: "10", ...over,
  };
}

test("monta o payload com emitente, destinatário e um item", () => {
  const { payload, error } = montarPayloadNfe(args());
  assert.equal(error, undefined);
  assert.equal(payload.cnpj_emitente, "45348469000154");
  assert.equal(payload.natureza_operacao, "Venda Dentro do Estado");
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

test("ICMS do seminovo: base é a margem, levada à nota como redução", () => {
  // Venda 200.000, aquisição 150.000 -> margem 50.000, que é 25% da venda,
  // logo a redução informada no XML é de 75%.
  const { impostos, payload } = montarPayloadNfe(args());
  assert.equal(impostos.margem, 50000);
  assert.equal(impostos.baseIcms, 50000);
  assert.equal(impostos.aliquotaIcms, 5);
  assert.equal(impostos.icms, 2500);
  assert.equal(payload.items[0].icms_base_calculo, 50000);
  assert.equal(payload.items[0].icms_valor, 2500);
  assert.equal(payload.items[0].icms_reducao_base_calculo, 75);
});

test("o custo de aquisição é a base do imposto — errá-lo erra a nota", () => {
  const barato = montarPayloadNfe(args({ custoAquisicao: 10000 })).payload.items[0];
  const caro = montarPayloadNfe(args({ custoAquisicao: 199000 })).payload.items[0];
  assert.ok(barato.icms_valor > caro.icms_valor, "aquisição maior -> imposto menor");
  assert.equal(caro.icms_base_calculo, 1000);
});

test("venda no prejuízo não gera imposto", () => {
  const { impostos } = montarPayloadNfe(args({ valorVenda: 140000, custoAquisicao: 150000 }));
  assert.equal(impostos.margem, 0);
  assert.equal(impostos.baseIcms, 0);
  assert.equal(impostos.icms, 0);
});

test("PIS e COFINS vão no item, sobre a base do ICMS menos o ICMS", () => {
  const item = montarPayloadNfe(args()).payload.items[0];
  assert.equal(item.pis_situacao_tributaria, "01");
  assert.equal(item.cofins_situacao_tributaria, "01");
  assert.equal(item.pis_base_calculo, 47500);   // 50.000 − 2.500
  assert.equal(item.cofins_base_calculo, 47500);
  assert.equal(item.pis_aliquota_porcentual, 0.65);
  assert.equal(item.cofins_aliquota_porcentual, 3);
  assert.equal(item.pis_valor, 308.75);
  assert.equal(item.cofins_valor, 1425);
});

// Os quatro campos que a SEFAZ recusou um a um em 11/08/2026, com a Mayra
// tentando emitir do outro lado. Nomes conferidos na referência da Focus.
test("payload leva os obrigatórios da NF-e 4.00 que faltavam", () => {
  const { payload } = montarPayloadNfe(args());
  assert.equal(payload.modalidade_frete, "9", "sem ocorrência de transporte");
  assert.equal(payload.presenca_comprador, "1");
  assert.equal(payload.consumidor_final, "1");
  assert.equal(payload.indicador_inscricao_estadual_destinatario, 9);
  assert.equal(payload.items[0].icms_modalidade_base_calculo, "3");
});

test("destinatário com inscrição estadual vira contribuinte, não 'não contribuinte'", () => {
  const { payload } = montarPayloadNfe(
    args({ destinatario: { ...DESTINATARIO, doc: "45348469000154", ie: "0054803330093" } })
  );
  assert.equal(payload.indicador_inscricao_estadual_destinatario, 1);
  assert.equal(payload.inscricao_estadual_destinatario, "0054803330093");
});

test("local_destino acompanha o CFOP, e a UF é normalizada", () => {
  // Este teste já afirmou que só a UF decidia. O contador corrigiu em
  // 14/08/2026: quem decide é a presencialidade da venda — ver os testes de
  // CFOP mais abaixo. Aqui fica só a normalização da UF.
  assert.equal(montarPayloadNfe(args()).payload.local_destino, 1, "MG -> MG");
  const fora = montarPayloadNfe(args({ destinatario: { ...DESTINATARIO, uf: "sp" }, vendaPresencial: false }));
  assert.equal(fora.payload.local_destino, 2);
  assert.equal(fora.payload.uf_destinatario, "SP", "UF normalizada em maiúscula");
});

test("informações complementares seguem o formato da nota autorizada", () => {
  const texto = textoInformacoesComplementares({
    config: { cnpj: "45348469000154", razao_social: "VAMAQ MOTORS" },
    custoAquisicao: 150000,
    numeroNotaEntrada: "10",
  });
  assert.equal(
    texto,
    "VEICULO USADO ADQ DE VAMAQ MOTORS, CNPJ 45.348.469/0001-54 CF NF 10 VLR DE AQUISICAO R$150.000,00."
  );
});

test("sem número da nota de entrada, o trecho 'CF NF' some — não vira 'CF NF undefined'", () => {
  const texto = textoInformacoesComplementares({
    config: { cnpj: "45348469000154" },
    custoAquisicao: 150000,
  });
  assert.ok(!/CF NF/.test(texto), texto);
  assert.ok(!/undefined|null|NaN/.test(texto), texto);
  assert.match(texto, /VLR DE AQUISICAO R\$150\.000,00\./);
});

test("o texto complementar entra no payload", () => {
  const { payload } = montarPayloadNfe(args({ numeroNotaEntrada: "10" }));
  assert.match(payload.informacoes_adicionais_contribuinte, /VEICULO USADO ADQ DE/);
  assert.match(payload.informacoes_adicionais_contribuinte, /CF NF 10/);
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
  // `impostos.base` não existe mais — e enquanto existiu com esse nome, este
  // teste passava sem testar nada: String(undefined).split(".")[1] é vazio.
  const casasDecimais = (n) => {
    assert.equal(typeof n, "number", "campo ausente passaria vazio por este teste");
    return (String(n).split(".")[1] || "").length;
  };
  for (const campo of ["icms_base_calculo", "icms_valor", "pis_valor", "cofins_valor"]) {
    assert.ok(casasDecimais(payload.items[0][campo]) <= 2, campo);
  }
  assert.ok(casasDecimais(impostos.baseIcms) <= 2);
  assert.ok(casasDecimais(impostos.basePisCofins) <= 2);
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
    numeroNotaEntrada: "11",
  });
  assert.ok(!r.error, r.error);
  const item = r.payload.items[0];
  assert.equal(item.icms_situacao_tributaria, "20", 'o campo do CST não pode levar a origem junto');
  assert.equal(item.icms_origem, "0");
  // O Porsche real: venda 175.000, aquisição 165.000 -> margem 10.000. A base
  // sai 9.999,50 porque o percentual de redução (94,286%) é arredondado a 3
  // casas e a base deriva dele — o mesmo mecanismo dos 15 centavos da NF 12.
  assert.equal(item.icms_base_calculo, 9999.5);
  assert.equal(item.icms_valor, 499.98);
});

test("CST que não existe no regime normal é barrado aqui, não na SEFAZ", () => {
  const r = montarPayloadNfe({
    config: { cnpj: "45348469000154", cfop: "5102", cst: "99", origem: "0", ncm: "87032100", serie: "1" },
    veiculo: { brand: "X", model: "Y", year: 2020, chassi: "ABC" },
    destinatario: { nome: "F", doc: "11122233344", cep: "38400100", logradouro: "R", numero: "1", bairro: "C", municipio: "U", uf: "MG" },
    valorVenda: 1000,
    custoAquisicao: 500,
    numeroNotaEntrada: "1",
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

// --- Respostas do contador (14/08/2026) --------------------------------------

test("nota de entrada é obrigatória — sem ela a emissão para aqui", () => {
  for (const vazio of ["", "   ", null, undefined]) {
    const r = montarPayloadNfe(args({ numeroNotaEntrada: vazio }));
    assert.ok(r.error, JSON.stringify(vazio));
    assert.match(r.error, /nota de entrada/i);
  }
});

test("grupo de pagamento vai a prazo, com descrição quando a forma é 'outros'", () => {
  const { payload } = montarPayloadNfe(args());
  assert.equal(payload.formas_pagamento.length, 1);
  const pag = payload.formas_pagamento[0];
  assert.equal(pag.indicador_pagamento, "1", "1 = a prazo");
  assert.equal(pag.forma_pagamento, "99");
  assert.equal(pag.descricao_pagamento, "A prazo", "tPag 99 exige xPag");
  assert.equal(pag.valor_pagamento, 200000);
});

test("forma de pagamento conhecida não manda descrição", () => {
  // xPag só existe para tPag 99; mandar junto de outro código é campo indevido.
  const { payload } = montarPayloadNfe(args({ config: { ...CONFIG, forma_pagamento: "15" } }));
  assert.equal(payload.formas_pagamento[0].forma_pagamento, "15");
  assert.equal(payload.formas_pagamento[0].descricao_pagamento, undefined);
});

// CFOP: o contador foi específico — 6102 só quando a venda NÃO é presencial.
// Comprador de outro estado que vem à loja fez operação interna.

test("venda presencial para outro estado continua interna (5102)", () => {
  const { payload } = montarPayloadNfe(
    args({ destinatario: { ...DESTINATARIO, uf: "SP" }, vendaPresencial: true })
  );
  assert.equal(payload.items[0].cfop, "5102");
  assert.equal(payload.local_destino, 1);
  assert.equal(payload.presenca_comprador, "1");
});

test("venda não presencial para outro estado vira interestadual (6102)", () => {
  const { payload } = montarPayloadNfe(
    args({ destinatario: { ...DESTINATARIO, uf: "SP" }, vendaPresencial: false })
  );
  assert.equal(payload.items[0].cfop, "6102");
  assert.equal(payload.local_destino, 2);
  assert.equal(payload.presenca_comprador, "2", "não presencial");
});

test("venda não presencial dentro de MG continua interna", () => {
  const { payload } = montarPayloadNfe(args({ vendaPresencial: false }));
  assert.equal(payload.items[0].cfop, "5102");
  assert.equal(payload.local_destino, 1);
});

test("presencial é o padrão — é como a Vamaq vende", () => {
  const { payload } = montarPayloadNfe(args({ destinatario: { ...DESTINATARIO, uf: "SP" } }));
  assert.equal(payload.items[0].cfop, "5102");
});

// Reforma tributária

test("IBS e CBS vão no item, sobre o VALOR TOTAL da nota", () => {
  // Contador, 14/08/2026: "pode deixar no valor total da nota". Eu tinha
  // assumido a margem por analogia com o ICMS — este teste já afirmou isso e
  // estava errado.
  const item = montarPayloadNfe(args()).payload.items[0];
  assert.equal(item.ibs_cbs_situacao_tributaria, "000");
  assert.equal(item.ibs_cbs_classificacao_tributaria, "000001");
  assert.equal(item.ibs_cbs_base_calculo, 200000, "valor da venda, não a margem");
  assert.equal(item.ibs_uf_aliquota, 0.1);
  assert.equal(item.ibs_uf_valor, 200);
  assert.equal(item.cbs_aliquota, 0.9);
  assert.equal(item.cbs_valor, 1800);
});

test("a base do IBS/CBS não é a do ICMS — são regimes diferentes", () => {
  // Guarda contra alguém "uniformizar" as duas bases achando que é limpeza:
  // o ICMS do seminovo incide sobre a margem, o IBS/CBS sobre a nota inteira.
  const item = montarPayloadNfe(args()).payload.items[0];
  assert.equal(item.icms_base_calculo, 50000);
  assert.equal(item.ibs_cbs_base_calculo, 200000);
  assert.notEqual(item.ibs_cbs_base_calculo, item.icms_base_calculo);
});

test("o IBS vai inteiro na competência estadual", () => {
  const item = montarPayloadNfe(args()).payload.items[0];
  assert.equal(item.ibs_mun_aliquota, 0);
  assert.equal(item.ibs_mun_valor, 0);
  assert.ok(item.ibs_uf_valor > 0);
});

test("indicador de bem móvel usado não é enviado", () => {
  // Ele existia para justificar a base reduzida pela margem. Com a base no
  // valor cheio, a justificativa sumiu — e o contador listou exatamente quais
  // campos mandar.
  assert.equal(montarPayloadNfe(args()).payload.items[0].bem_movel_usado, undefined);
});

test("IBS/CBS pode ser desligado por configuração, sem bloquear a emissão", () => {
  const r = montarPayloadNfe(args({ config: { ...CONFIG, ibs_cbs_ativo: false } }));
  assert.ok(!r.error, r.error);
  const item = r.payload.items[0];
  for (const campo of ["ibs_cbs_situacao_tributaria", "ibs_uf_valor", "cbs_valor"]) {
    assert.equal(item[campo], undefined, campo);
  }
  assert.equal(item.icms_valor, 2500, "o resto da nota continua igual");
});
