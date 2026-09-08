/**
 * A Cláusula Segunda do contrato de venda diz a verdade sobre o pagamento.
 *
 * O PEDIDO (Mayra, 08/09/2026, por áudio): "a gente coloca o preço, aí aparece
 * que vai ser pago via PIX — e a gente coloca lá no final, na observação, que
 * foi parcelado, se foi financiamento, qual o valor do financiamento, qual o
 * valor à vista. Só que a maioria dos clientes está questionando: em cima
 * aparece à vista e só embaixo a informação."
 *
 * O DEFEITO: o corpo da cláusula era string fixa terminando em "à vista, em
 * parcela única (...) plena, geral e irrevogável quitação". Numa venda
 * financiada o contrato afirmava, na cláusula do preço, um pagamento à vista
 * que não houve — e dava quitação de um dinheiro que o banco ainda não tinha
 * liberado. A observação no fim da página não conserta: contradiz.
 *
 * O DESENHO: forma de pagamento é dimensão SEPARADA da troca. A troca decide
 * de que o preço é feito; a forma decide como a parcela em DINHEIRO é paga.
 * Onde não entra dinheiro (troca quitando tudo, ou volta que a Vamaq paga) não
 * há forma a escolher — e é isso que os dois últimos testes protegem.
 *
 *   npm test   (não precisa de banco: build() é função pura)
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./tests/helpers/mock-session-loader.mjs", pathToFileURL("./"));

import { test } from "node:test";
import assert from "node:assert/strict";

const { DEFAULT_TEMPLATES } = await import("../src/lib/contractTemplates.js");

const venda = DEFAULT_TEMPLATES.find((t) => t.id === "venda");

/** Só a Cláusula Segunda — o resto do contrato não é assunto deste teste. */
function clausulaSegunda(texto) {
  const i = texto.indexOf("CLÁUSULA SEGUNDA – DO PREÇO E DA FORMA DE PAGAMENTO");
  assert.ok(i >= 0, "contrato saiu sem a Cláusula Segunda");
  const resto = texto.slice(i);
  const fim = resto.indexOf("\n\nCLÁUSULA TERCEIRA");
  return fim >= 0 ? resto.slice(0, fim) : resto;
}

const BASE = {
  comprador_nome: "João da Silva",
  comprador_cpf: "529.982.247-25",
  veiculo_marca: "Toyota",
  veiculo_modelo: "Corolla XEI",
  veiculo_placa: "ABC1D23",
  veiculo_chassi: "9BR53ZEC4M4000000",
  valor_total: "107.000,00",
  data_contrato: "2026-09-08",
};

const QUITACAO_IMEDIATA = "plena, geral e irrevogável quitação";
const TEXTO_A_VISTA =
  "à vista, em parcela única, na data de assinatura deste instrumento, mediante transferência bancária ou PIX em favor da VENDEDORA";

// --- À vista: o caso mais comum não pode mudar uma vírgula -------------------

test("sem forma escolhida, a cláusula continua a de hoje — à vista, PIX, quitação plena", () => {
  const c = clausulaSegunda(venda.build(BASE));

  assert.match(c, /R\$ 107\.000,00 \(cento e sete mil reais\)/);
  assert.ok(c.includes(TEXTO_A_VISTA), "perdeu o texto à vista que já existia");
  assert.ok(c.includes(QUITACAO_IMEDIATA), "à vista deve seguir quitando na hora");
});

test("escolher 'À vista / PIX' dá exatamente o mesmo contrato que não escolher nada", () => {
  const semEscolha = venda.build(BASE);
  const comEscolha = venda.build({ ...BASE, venda_forma_pagamento: "À vista / PIX" });

  assert.equal(comEscolha, semEscolha);
});

// --- Financiamento ----------------------------------------------------------

const FINANCIADA = {
  ...BASE,
  venda_forma_pagamento: "Financiamento bancário",
  venda_entrada: "27.000,00",
  venda_valor_financiado: "80.000,00",
  venda_instituicao_financeira: "Banco Bradesco Financiamentos S.A.",
};

test("financiamento traz entrada, valor financiado e instituição para dentro da cláusula", () => {
  const c = clausulaSegunda(venda.build(FINANCIADA));

  assert.match(c, /R\$ 27\.000,00 \(vinte e sete mil reais\)/);
  assert.match(c, /R\$ 80\.000,00 \(oitenta mil reais\)/);
  assert.match(c, /BANCO BRADESCO FINANCIAMENTOS S\.A\./);
});

test("financiamento não afirma pagamento à vista", () => {
  const c = clausulaSegunda(venda.build(FINANCIADA));

  assert.ok(
    !c.includes("à vista, em parcela única"),
    "cláusula financiada não pode dizer que o preço foi pago à vista"
  );
});

test("financiamento condiciona a quitação à liberação do valor pelo banco", () => {
  const c = clausulaSegunda(venda.build(FINANCIADA));

  assert.ok(
    !c.includes(QUITACAO_IMEDIATA),
    "não se dá quitação irrevogável de dinheiro que o banco ainda não liberou"
  );
  assert.match(c, /quita(ção|r-se)[^.]*(liberação|compensação)/i);
});

test("financiamento sem entrada sai sem falar em entrada", () => {
  const c = clausulaSegunda(
    venda.build({ ...FINANCIADA, venda_entrada: "" })
  );

  assert.match(c, /R\$ 80\.000,00/);
  assert.ok(!/entrada/i.test(c), "não havia entrada: a cláusula não deve citar uma");
});

// --- Personalizado ----------------------------------------------------------

test("forma personalizada escreve o texto da negociação na Cláusula Segunda", () => {
  const descricao =
    "R$ 40.000,00 em dinheiro na assinatura e 3 (três) parcelas mensais de R$ 22.333,33, vencendo a primeira em 08/10/2026.";
  const c = clausulaSegunda(
    venda.build({
      ...BASE,
      venda_forma_pagamento: "Personalizado",
      venda_pagamento_descricao: descricao,
    })
  );

  assert.ok(c.includes(descricao), "o texto da negociação tem que sair na cláusula do preço");
  assert.ok(!c.includes(TEXTO_A_VISTA), "personalizado não é à vista");
  assert.ok(!c.includes(QUITACAO_IMEDIATA), "quitação depende do efetivo pagamento");
});

// --- Convivência com a troca ------------------------------------------------

test("troca que quita o preço inteiro ignora a forma de pagamento", () => {
  // Não entra dinheiro nenhum: escolher financiamento aqui é erro de
  // preenchimento, e o contrato não pode inventar um financiamento por causa
  // de um select esquecido.
  const comTroca = {
    ...BASE,
    troca_marca: "Honda",
    troca_placa: "XYZ9K88",
    troca_valor: "107.000,00",
  };
  const semForma = venda.build(comTroca);
  const comForma = venda.build({
    ...comTroca,
    venda_forma_pagamento: "Financiamento bancário",
    venda_valor_financiado: "80.000,00",
  });

  assert.equal(comForma, semForma);
});

test("volta paga pela Vamaq ignora a forma de pagamento", () => {
  // Aqui o dinheiro SAI da loja. Não há o que financiar.
  const comVolta = {
    ...BASE,
    troca_marca: "Honda",
    troca_placa: "XYZ9K88",
    venda_diferenca: "15.000,00",
    venda_diferenca_direcao: "VENDEDORA (Vamaq) paga a volta ao comprador",
  };
  const semForma = venda.build(comVolta);
  const comForma = venda.build({
    ...comVolta,
    venda_forma_pagamento: "Financiamento bancário",
    venda_valor_financiado: "80.000,00",
  });

  assert.equal(comForma, semForma);
});

test("troca com saldo do comprador financia o saldo, não o preço cheio", () => {
  const c = clausulaSegunda(
    venda.build({
      ...BASE,
      troca_marca: "Honda",
      troca_placa: "XYZ9K88",
      venda_diferenca: "40.000,00",
      venda_diferenca_direcao: "COMPRADOR paga o saldo à Vamaq",
      venda_forma_pagamento: "Financiamento bancário",
      venda_valor_financiado: "40.000,00",
      venda_instituicao_financeira: "Banco Bradesco Financiamentos S.A.",
    })
  );

  assert.match(c, /VEÍCULO RECEBIDO NA TROCA/, "a troca continua descrita");
  assert.match(c, /R\$ 40\.000,00 \(quarenta mil reais\)/);
  assert.match(c, /BANCO BRADESCO FINANCIAMENTOS S\.A\./);
  assert.ok(
    !c.includes("à vista, em parcela única"),
    "o saldo é financiado: não pode sair como pago à vista"
  );
});

// --- Formulário -------------------------------------------------------------

test("o formulário oferece a forma de pagamento com À vista como primeira opção", () => {
  const campo = venda.fields.find((f) => f.key === "venda_forma_pagamento");

  assert.ok(campo, "o modelo de venda precisa expor o campo de forma de pagamento");
  assert.equal(campo.type, "select");
  // A tela usa options[0] quando o campo nunca foi tocado: a primeira opção é
  // o padrão de fato, e o padrão tem que continuar sendo o de hoje.
  assert.equal(campo.options[0], "À vista / PIX");
  assert.deepEqual(campo.options, [
    "À vista / PIX",
    "Financiamento bancário",
    "Personalizado",
  ]);
});

test("os campos do financiamento e do texto personalizado existem no formulário", () => {
  const chaves = venda.fields.map((f) => f.key);

  for (const k of [
    "venda_entrada",
    "venda_valor_financiado",
    "venda_instituicao_financeira",
    "venda_pagamento_descricao",
  ]) {
    assert.ok(chaves.includes(k), `faltou o campo ${k} no formulário`);
  }
});
