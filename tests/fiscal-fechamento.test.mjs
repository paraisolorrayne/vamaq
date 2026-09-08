/**
 * O fechamento do mês: quantas notas e quanto, separado como o contador separa.
 *
 * O PEDIDO (Mayra, 04/09/2026, por áudio): "o Rodrigo da contabilidade me
 * perguntou o total de notas emitidas de venda e o total de compra (...) ou
 * consignação. Porque ele tá fazendo fechamento. Se eu pegar e somar as notas,
 * abrir uma por uma (...) eu consigo ver o valor. Mas tem alguma outra forma,
 * um relatório?"
 *
 * A DECISÃO QUE ESTES TESTES GUARDAM: só nota AUTORIZADA entra no total —
 * cancelada e em processamento não existem para a SEFAZ, e somá-las daria ao
 * contador um número que muda depois. Elas viram aviso, com quantidade, porque
 * cancelada é justamente o que explica o pulo na numeração.
 *
 * A distinção compra × consignação é a mais fácil de errar: as duas são
 * `operacao = 'entrada'` e só o CFOP as separa. Caiu na caixa errada, o
 * contador fecha o mês com o estoque errado.
 *
 *   npm test   (não precisa de banco: resumirNotas é função pura)
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  resumirNotas,
  CFOP_CONSIGNACAO_RECEBIDA,
  SQL_TOTAIS_DO_MES,
} from "../src/lib/fiscal/fechamento.js";
import { SQL_NOTAS_DO_MES } from "../src/lib/fiscal/pacote.js";

/** Uma nota autorizada, com o mínimo que o resumo lê. */
function nota(extra) {
  return { operacao: "saida", cfop: "5102", status: "autorizada", valor: 100, ...extra };
}

function caixa(resumo, chave) {
  const linha = resumo.linhas.find((l) => l.chave === chave);
  assert.ok(linha, `o resumo não trouxe a linha "${chave}"`);
  return linha;
}

// --- As quatro caixas --------------------------------------------------------

test("nota de saída conta como venda", () => {
  const r = resumirNotas([nota({ operacao: "saida", valor: 107000 })]);

  assert.equal(caixa(r, "venda").quantidade, 1);
  assert.equal(caixa(r, "venda").valor, 107000);
});

test("entrada com CFOP de consignação não vira compra", () => {
  for (const cfop of CFOP_CONSIGNACAO_RECEBIDA) {
    const r = resumirNotas([nota({ operacao: "entrada", cfop, valor: 90000 })]);

    assert.equal(caixa(r, "consignacao").quantidade, 1, `CFOP ${cfop} devia ser consignação`);
    assert.equal(caixa(r, "compra").quantidade, 0, `CFOP ${cfop} caiu em compra`);
  }
});

test("entrada com CFOP comum é compra", () => {
  const r = resumirNotas([nota({ operacao: "entrada", cfop: "1102", valor: 90000 })]);

  assert.equal(caixa(r, "compra").quantidade, 1);
  assert.equal(caixa(r, "consignacao").quantidade, 0);
});

test("devolução de consignação não é contada como venda", () => {
  // Sai da loja como a venda sai, mas devolve o carro ao dono: somar junto
  // inflaria o faturamento do mês.
  const r = resumirNotas([nota({ operacao: "devolucao", cfop: "5918", valor: 90000 })]);

  assert.equal(caixa(r, "devolucao").quantidade, 1);
  assert.equal(caixa(r, "venda").quantidade, 0);
});

// --- O que não soma ----------------------------------------------------------

test("nota cancelada não soma, mas é avisada", () => {
  const r = resumirNotas([
    nota({ valor: 107000 }),
    nota({ status: "cancelada", valor: 50000 }),
  ]);

  assert.equal(caixa(r, "venda").quantidade, 1, "a cancelada não pode entrar na contagem");
  assert.equal(caixa(r, "venda").valor, 107000, "a cancelada não pode entrar no valor");
  assert.equal(r.canceladas, 1);
});

test("nota em processamento não soma, mas é avisada", () => {
  const r = resumirNotas([
    nota({ valor: 107000 }),
    nota({ status: "processando", valor: 50000 }),
  ]);

  assert.equal(caixa(r, "venda").valor, 107000);
  assert.equal(r.processando, 1);
});

test("nota com erro não soma nem some do aviso", () => {
  const r = resumirNotas([nota({ status: "erro", valor: 50000 })]);

  assert.equal(caixa(r, "venda").quantidade, 0);
  assert.equal(r.comErro, 1);
});

// --- Somas e bordas ----------------------------------------------------------

test("as notas do mesmo tipo somam", () => {
  const r = resumirNotas([
    nota({ operacao: "saida", valor: 107000 }),
    nota({ operacao: "saida", valor: 93000 }),
    nota({ operacao: "entrada", cfop: "1102", valor: 80000 }),
  ]);

  assert.equal(caixa(r, "venda").quantidade, 2);
  assert.equal(caixa(r, "venda").valor, 200000);
  assert.equal(caixa(r, "compra").valor, 80000);
});

test("mês sem nota nenhuma devolve as quatro linhas zeradas", () => {
  const r = resumirNotas([]);

  assert.deepEqual(
    r.linhas.map((l) => [l.chave, l.quantidade, l.valor]),
    [
      ["venda", 0, 0],
      ["compra", 0, 0],
      ["consignacao", 0, 0],
      ["devolucao", 0, 0],
    ]
  );
  assert.equal(r.canceladas, 0);
  assert.equal(r.processando, 0);
});

test("valor nulo no banco não vira NaN no relatório do contador", () => {
  const r = resumirNotas([nota({ valor: null }), nota({ valor: "107000.00" })]);

  assert.equal(caixa(r, "venda").valor, 107000);
});

test("cada linha vem com rótulo pronto para a tela", () => {
  const r = resumirNotas([]);

  for (const linha of r.linhas) {
    assert.equal(typeof linha.rotulo, "string");
    assert.ok(linha.rotulo.length > 0, `linha ${linha.chave} sem rótulo`);
  }
});

// --- O recorte do mês --------------------------------------------------------

test("o resumo usa o mesmo recorte de mês do pacote de XMLs", () => {
  // Se os dois divergirem, o contador recebe um zip com um conjunto de notas e
  // um resumo com outro — e a conferência dele nunca fecha.
  const janela = /created_at >= make_date\(\$1, \$2, 1\)[\s\S]*created_at <\s+make_date\(\$1, \$2, 1\) \+ interval '1 month'/;

  assert.match(SQL_NOTAS_DO_MES, janela);
  assert.match(SQL_TOTAIS_DO_MES, janela);
});

test("o resumo NÃO exige xml_url — a nota sem arquivo ainda foi emitida", () => {
  // O pacote de XMLs filtra por xml_url porque sem arquivo não há o que zipar.
  // O total é outra pergunta: a nota existe, tem valor e conta no fechamento.
  assert.ok(!/xml_url/.test(SQL_TOTAIS_DO_MES));
});
