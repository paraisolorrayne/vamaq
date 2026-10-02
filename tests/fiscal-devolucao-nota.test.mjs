/**
 * Devolução de nota autorizada — o caminho para corrigir o VALOR de uma nota
 * de mês já apurado.
 *
 * O CASO (02/10/2026): numa negociação o valor mudou depois de emitidas duas
 * notas de agosto — uma pelo sistema, outra pelo escritório. Agosto já foi
 * apurado e pago, então não cabe cancelamento, nem o extemporâneo. O contador
 * Rodrigo: tem que ser nota de devolução, e depois a nota nova com o valor
 * certo.
 *
 * A devolução nasce do XML da nota original, não de digitação: os impostos da
 * devolução de venda têm que ser OS MESMOS da venda (é isso que estorna o
 * débito), e redigitar base, alíquota e valor de quatro tributos é como a
 * devolução sai com um centavo de diferença.
 *
 * Puro — sem banco, sem rede.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { lerNotaXml } from "../src/lib/fiscal/xmlNota.js";
import { montarPayloadDevolucao } from "../src/lib/fiscal/payload.js";
import {
  xmlVenda,
  xmlEntrada,
  CHAVE_VENDA,
  CHAVE_ENTRADA_ESCRITORIO,
} from "./helpers/xml-nfe.mjs";

const CONFIG = {
  cnpj: "45348469000154", cfop: "5102", cst: "20", ncm: "87032100", serie: "2",
  uf: "MG", origem: "0",
};
const VEICULO = {
  brand: "Porsche", model: "Cayenne", year: 2016, placa: "PAS4I58",
  chassi: "WP1AA2923GKA14408",
};

function devolver(xml, over = {}) {
  const original = lerNotaXml(xml);
  assert.equal(original.error, undefined, original.error);
  return montarPayloadDevolucao({ config: CONFIG, veiculo: VEICULO, original, ...over });
}

// ── leitura do XML ──────────────────────────────────────────────────────────

test("lê a chave, o sentido e quem é a outra parte da nota de venda", () => {
  const n = lerNotaXml(xmlVenda());
  assert.equal(n.chave, CHAVE_VENDA);
  assert.equal(n.tipoDocumento, 1);
  assert.equal(n.finalidade, 1);
  assert.equal(n.emitenteCnpj, "45348469000154");
  assert.equal(n.numero, "1");
  assert.equal(n.serie, "2");
  assert.equal(n.valorTotal, 330000);
  assert.deepEqual(n.contraparte, {
    nome: "Maria Compradora",
    doc: "52998224725",
    ie: "",
    cep: "38400100",
    logradouro: "Rua das Flores",
    numero: "100",
    bairro: "Centro",
    municipio: "Uberlandia",
    uf: "MG",
  });
});

test("os impostos saem do ITEM, não do total da nota — os dois têm vBC", () => {
  const { item } = lerNotaXml(xmlVenda());
  assert.equal(item.cfop, "5102");
  assert.equal(item.icms.cst, "20");
  assert.equal(item.icms.origem, "0");
  assert.equal(item.icms.baseCalculo, 15715.4); // o total do fixture diz 99999.99
  assert.equal(item.icms.aliquota, 5);
  assert.equal(item.icms.valor, 785.77);
  assert.equal(item.icms.reducaoBase, 95.238);
  assert.equal(item.pis.baseCalculo, 14929.63);
  assert.equal(item.pis.valor, 97.04);
  assert.equal(item.cofins.aliquota, 3);
  assert.equal(item.ibsCbs.cst, "000");
  assert.equal(item.ibsCbs.baseCalculo, 330000);
  assert.equal(item.ibsCbs.ibsUfValor, 330);
  assert.equal(item.ibsCbs.cbsValor, 2970);
});

test("acha o chassi na descrição do item", () => {
  assert.equal(lerNotaXml(xmlEntrada()).chassi, "WP1AA2923GKA14408");
});

test("arquivo que não é NF-e é recusado em português", () => {
  assert.match(lerNotaXml("<html>oi</html>").error, /não parece ser o XML de uma nota/i);
  assert.match(lerNotaXml("").error, /não parece ser o XML de uma nota/i);
});

// ── devolução de VENDA (1202) ───────────────────────────────────────────────

test("devolução de venda é ENTRADA 1202, finalidade 4, citando a chave da venda", () => {
  const { payload, tipo, error } = devolver(xmlVenda());
  assert.equal(error, undefined);
  assert.equal(tipo, "venda");
  assert.equal(payload.tipo_documento, 0);
  assert.equal(payload.finalidade_emissao, 4);
  assert.deepEqual(payload.notas_referenciadas, [{ chave_nfe: CHAVE_VENDA }]);
  assert.equal(payload.items[0].cfop, "1202");
  assert.equal(payload.local_destino, 1);
  assert.equal(payload.valor_total, 330000);
  assert.equal(payload.serie, "2");
});

test("devolução de venda repete os impostos da venda, centavo por centavo", () => {
  const { payload } = devolver(xmlVenda());
  const it = payload.items[0];
  assert.equal(it.icms_situacao_tributaria, "20");
  assert.equal(it.icms_origem, "0");
  assert.equal(it.icms_modalidade_base_calculo, "3");
  assert.equal(it.icms_reducao_base_calculo, 95.238);
  assert.equal(it.icms_base_calculo, 15715.4);
  assert.equal(it.icms_aliquota, 5);
  assert.equal(it.icms_valor, 785.77);
  assert.equal(it.pis_situacao_tributaria, "01");
  assert.equal(it.pis_base_calculo, 14929.63);
  assert.equal(it.pis_aliquota_porcentual, 0.65);
  assert.equal(it.pis_valor, 97.04);
  assert.equal(it.cofins_valor, 447.89);
  assert.equal(it.ibs_cbs_situacao_tributaria, "000");
  assert.equal(it.ibs_cbs_classificacao_tributaria, "000001");
  assert.equal(it.ibs_cbs_base_calculo, 330000);
  assert.equal(it.ibs_uf_aliquota, 0.1);
  assert.equal(it.ibs_uf_valor, 330);
  assert.equal(it.ibs_mun_valor, 0);
  assert.equal(it.cbs_aliquota, 0.9);
  assert.equal(it.cbs_valor, 2970);
  assert.equal(it.valor_bruto, 330000);
  assert.equal(it.descricao, "Porsche Cayenne 2016 - Placa PAS4I58 - Chassi WP1AA2923GKA14408");
});

test("venda que saiu sem IBS/CBS volta sem IBS/CBS", () => {
  const { payload } = devolver(xmlVenda({ semIbsCbs: true }));
  assert.equal(payload.items[0].ibs_cbs_situacao_tributaria, undefined);
  assert.equal(payload.items[0].cbs_valor, undefined);
});

test("devolução não tem pagamento: tPag 90 com valor zero", () => {
  const { payload } = devolver(xmlVenda());
  assert.deepEqual(payload.formas_pagamento, [{ forma_pagamento: "90", valor_pagamento: 0 }]);
});

test("devolução de venda interestadual (6102) volta como 2202", () => {
  const { payload } = devolver(xmlVenda({ cfop: "6102", idDest: 2 }));
  assert.equal(payload.items[0].cfop, "2202");
  assert.equal(payload.local_destino, 2);
});

test("comprador PJ com IE volta com CNPJ e IE", () => {
  const { payload } = devolver(
    xmlVenda({ comprador: { doc: "11222333000181", nome: "Locadora Ltda", ie: "0012345670011" } })
  );
  assert.equal(payload.cnpj_destinatario, "11222333000181");
  assert.equal(payload.cpf_destinatario, undefined);
  assert.equal(payload.indicador_inscricao_estadual_destinatario, 1);
  assert.equal(payload.inscricao_estadual_destinatario, "0012345670011");
});

test("o texto complementar diz qual nota está sendo devolvida", () => {
  const { payload } = devolver(xmlVenda());
  assert.match(payload.informacoes_adicionais_contribuinte, /NF 1 SERIE 2/);
  assert.match(payload.informacoes_adicionais_contribuinte, new RegExp(CHAVE_VENDA));
});

// ── devolução de COMPRA (5202) ──────────────────────────────────────────────

test("devolução de compra é SAÍDA 5202, sem imposto, para quem vendeu o carro", () => {
  const { payload, tipo, error } = devolver(xmlEntrada());
  assert.equal(error, undefined);
  assert.equal(tipo, "compra");
  assert.equal(payload.tipo_documento, 1);
  assert.equal(payload.finalidade_emissao, 4);
  assert.deepEqual(payload.notas_referenciadas, [{ chave_nfe: CHAVE_ENTRADA_ESCRITORIO }]);
  assert.equal(payload.items[0].cfop, "5202");
  assert.equal(payload.items[0].icms_situacao_tributaria, "41");
  assert.equal(payload.items[0].icms_valor, 0);
  assert.equal(payload.nome_destinatario, "Joao Vendedor");
  assert.equal(payload.cpf_destinatario, "52998224725");
  assert.equal(payload.valor_total, 160000);
  assert.deepEqual(payload.formas_pagamento, [{ forma_pagamento: "90", valor_pagamento: 0 }]);
});

test("a nota do escritório (série 1) é devolvida pela série do sistema", () => {
  const { payload } = devolver(xmlEntrada({ serie: 1 }));
  assert.equal(payload.serie, "2");
});

test("compra de outro estado (2102) volta como 6202", () => {
  const { payload } = devolver(
    xmlEntrada({ cfop: "2102", vendedor: { doc: "52998224725", nome: "Joao", uf: "GO", municipio: "Catalao" } })
  );
  assert.equal(payload.items[0].cfop, "6202");
  assert.equal(payload.local_destino, 2);
});

// ── recusas ─────────────────────────────────────────────────────────────────

test("nota de outra empresa é recusada", () => {
  const { error } = devolver(xmlVenda(), { config: { ...CONFIG, cnpj: "11222333000181" } });
  assert.match(error, /não foi emitida pela Vamaq/i);
});

test("consignação não passa por aqui: tem o botão próprio", () => {
  const { error } = devolver(xmlEntrada({ cfop: "1917" }));
  assert.match(error, /Devolver carro consignado ao dono/);
});

test("nota que já é devolução não se devolve", () => {
  const { error } = devolver(xmlVenda({ finNFe: 4 }));
  assert.match(error, /já é uma devolução/i);
});

test("XML de outro carro é recusado — o chassi não bate", () => {
  const { error } = devolver(xmlVenda({ chassi: "9BWZZZ377VT004251" }));
  assert.match(error, /chassi/i);
  assert.match(error, /9BWZZZ377VT004251/);
});

test("nota com mais de um item é recusada em vez de devolvida pela metade", () => {
  const { error } = devolver(xmlVenda({ itens: 2 }));
  assert.match(error, /um item/i);
});
