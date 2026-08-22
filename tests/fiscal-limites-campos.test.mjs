/**
 * Os limites de tamanho dos campos da NF-e, conferidos ANTES de mandar.
 *
 * O QUE ACONTECEU (22/08/2026): a Mayra emitiu uma nota de consignação e a
 * SEFAZ recusou com
 *
 *   natOp: [facet 'maxLength'] The value has a length of '69';
 *   this exceeds the allowed maximum length of '60'
 *
 * O texto tinha 69 caracteres porque a descrição oficial do CFOP 1917 foi
 * copiada para `natOp`, que é campo livre limitado a 60. A descrição do CFOP
 * pertence à tabela de CFOP; não é a natureza da operação da nota.
 *
 * DUAS COISAS ERRADAS, NÃO UMA:
 *
 *   1. O texto estourava — corrigido, e o da devolução (71) também, que nunca
 *      chegou a ser usado e teria falhado igual na primeira tentativa.
 *   2. Nada conferia. Um limite de tamanho é a coisa mais fácil de checar
 *      antes de enviar e a mais opaca de entender depois: a recusa vem em
 *      inglês citando a tag do XML, que ninguém que opera a loja reconhece.
 *
 * Este arquivo cobre a segunda. O objetivo não é uma nota específica — é que
 * NENHUMA nota saia daqui com campo acima do limite, incluindo as que ainda
 * não existem.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { montarPayloadNfe, montarPayloadEntrada } from "../src/lib/fiscal/payload.js";

const CONFIG = {
  cnpj: "45.348.469/0001-54",
  cfop: "5102",
  cst: "020",
  ncm: "87032100",
  serie: "2",
  origem: "0",
  natureza_operacao: "Venda Dentro do Estado",
  cfop_entrada: "1102",
  natureza_entrada: "Compra Dentro do Estado",
  cst_entrada: "041",
};

const VEICULO = {
  brand: "Porsche", model: "Cayenne", year: 2016,
  placa: "PAS4I58", chassi: "WP1AA2923GKA14408",
};

const DEST = {
  nome: "Comprador Exemplo", doc: "529.982.247-25", cep: "38411-108",
  logradouro: "Rua Exemplo", numero: "10", bairro: "Centro",
  municipio: "Uberlândia", uf: "MG",
};

const venda = (extra = {}) =>
  montarPayloadNfe({
    config: CONFIG, veiculo: VEICULO, destinatario: DEST,
    valorVenda: 175000, custoAquisicao: 160000,
    numeroNotaEntrada: "10", vendaPresencial: true, ...extra,
  });

const entrada = (extra = {}) =>
  montarPayloadEntrada({
    config: CONFIG, veiculo: VEICULO, remetente: DEST,
    valorAquisicao: 160000, ...extra,
  });

test("natureza da operação acima de 60 é recusada aqui, não pela SEFAZ", () => {
  // Exatamente o texto de 69 caracteres que a SEFAZ recusou.
  const longa = "entrada de mercadoria recebida em consignacao mercantil ou industrial";
  assert.equal(longa.length, 69);
  const { error, payload } = entrada({
    config: { ...CONFIG, natureza_entrada: longa },
  });
  assert.equal(payload, undefined, "não pode montar uma nota que a SEFAZ vai recusar");
  assert.match(error, /natureza da operação/i);
  assert.match(error, /69/);
  assert.match(error, /60/);
});

test("a mensagem diz o campo da tela e quanto sobra — não a tag do XML", () => {
  const { error } = venda({
    destinatario: { ...DEST, nome: "A".repeat(72) },
  });
  // "xNome" não significa nada para quem opera a loja.
  assert.doesNotMatch(error, /xNome|natOp|xLgr|maxLength|facet/i);
  assert.match(error, /nome/i);
  assert.match(error, /Encurte em 12/);
});

test("cada campo de endereço tem o seu limite conferido", () => {
  for (const campo of ["logradouro", "bairro", "municipio"]) {
    const { error, payload } = venda({
      destinatario: { ...DEST, [campo]: "X".repeat(61) },
    });
    assert.equal(payload, undefined, `${campo} acima do limite deveria recusar`);
    assert.match(error, /61 caracteres/);
  }
});

test("exatamente no limite passa — 60 é permitido, 61 não", () => {
  assert.equal(venda({ destinatario: { ...DEST, nome: "A".repeat(60) } }).error, undefined);
  assert.ok(venda({ destinatario: { ...DEST, nome: "A".repeat(61) } }).error);
});

test("a descrição do veículo tem limite maior (120), e é conferida", () => {
  const { error, payload } = venda({
    veiculo: { ...VEICULO, model: "M".repeat(140) },
  });
  assert.equal(payload, undefined);
  assert.match(error, /descrição do veículo/i);
  assert.match(error, /120/);
});

test("a entrada passa pela mesma conferência que a venda", () => {
  const { error, payload } = entrada({
    remetente: { ...DEST, bairro: "B".repeat(80) },
  });
  assert.equal(payload, undefined);
  assert.match(error, /bairro/i);
});

test("as notas normais da loja continuam saindo", () => {
  // A conferência não pode barrar o caso comum.
  assert.equal(venda().error, undefined);
  assert.equal(entrada().error, undefined);
  assert.equal(entrada({ consignacao: true }).error, undefined);
});

test("as naturezas configuradas hoje cabem no limite", () => {
  // Os quatro textos que o sistema usa. Se algum crescer, este teste avisa
  // antes de a nota ser recusada em produção.
  const naturezas = [
    "Venda Dentro do Estado",
    "Compra Dentro do Estado",
    "Entrada de mercadoria em consignacao mercantil",
    "Devolucao de mercadoria em consignacao mercantil",
  ];
  for (const n of naturezas) {
    assert.ok(n.length <= 60, `"${n}" tem ${n.length} caracteres, o limite é 60`);
  }
});
