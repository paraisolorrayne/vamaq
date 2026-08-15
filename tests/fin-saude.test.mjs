/**
 * Score de saúde financeira.
 *
 * A propriedade que estes testes protegem acima das outras: **falta de dado não
 * é nota zero**. Uma loja que ainda não cadastrou orçamento não é uma empresa
 * doente. Se isso quebrar, o score vira um número que pune quem está começando
 * — e ninguém volta a olhar para ele.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { faixaSaude, MINIMO_PARA_VEREDITO, scoreSaudeFinanceira } from "../src/lib/fin/saude.js";

/** Mês bom: lucro de 12%, dentro do orçamento, tudo em dia. */
const MES_BOM = {
  receita: 500000, lucroLiquido: 60000,
  custos: 400000, despesas: 40000,
  receitaMeta: 500000, custoMeta: 420000, despesaMeta: 45000,
  contasVencidas: 0, contasTotal: 8,
  lancamentosPendentes: 0, lancamentosSemConta: 0, lancamentosTotal: 30,
  veiculosVendidos: 4, veiculosComLucro: 4,
};

test("mês bom tira nota cheia", () => {
  const r = scoreSaudeFinanceira(MES_BOM);
  assert.equal(r.score, 100);
  assert.equal(r.avaliados, 5);
  assert.ok(r.componentes.every((c) => c.avaliado));
});

test("sem orçamento cadastrado, o componente sai da conta em vez de zerar", () => {
  // O caso real: a Vamaq pode não ter orçamento do ano cadastrado. Pontuar
  // isso como zero daria 75/100 para um mês impecável.
  const semOrcamento = { ...MES_BOM, receitaMeta: 0, custoMeta: 0, despesaMeta: 0 };
  const r = scoreSaudeFinanceira(semOrcamento);
  assert.equal(r.score, 100, "os outros quatro componentes continuam cheios");
  assert.equal(r.avaliados, 4);
  const orc = r.componentes.find((c) => c.id === "orcamento");
  assert.equal(orc.avaliado, false);
  assert.equal(orc.pontos, null);
  assert.match(orc.detalhe, /sem orçamento/i);
});

test("empresa sem nenhum dado devolve score nulo, não zero", () => {
  const r = scoreSaudeFinanceira({});
  assert.equal(r.score, null);
  assert.equal(r.avaliados, 0);
  assert.equal(faixaSaude(r.score).rotulo, "sem dados");
});

test("prejuízo zera o componente de resultado, mas não o score inteiro", () => {
  const r = scoreSaudeFinanceira({ ...MES_BOM, lucroLiquido: -20000 });
  const res = r.componentes.find((c) => c.id === "resultado");
  assert.equal(res.pontos, 0);
  assert.match(res.detalhe, /prejuízo/i);
  assert.ok(r.score > 0 && r.score < 100, `score ${r.score}`);
});

test("margem de 5% dá metade dos pontos de resultado", () => {
  const r = scoreSaudeFinanceira({ ...MES_BOM, lucroLiquido: 25000 }); // 5% de 500.000
  const res = r.componentes.find((c) => c.id === "resultado");
  assert.equal(res.pontos, 15, "metade de 30");
  assert.match(res.detalhe, /5\.0%/);
});

test("margem acima de 10% não passa do teto", () => {
  const r = scoreSaudeFinanceira({ ...MES_BOM, lucroLiquido: 250000 });
  assert.equal(r.componentes.find((c) => c.id === "resultado").pontos, 30);
});

test("estouro de custo tira parte da aderência ao orçamento", () => {
  const r = scoreSaudeFinanceira({ ...MES_BOM, custos: 500000 });
  const orc = r.componentes.find((c) => c.id === "orcamento");
  assert.ok(orc.pontos < 25, `deu ${orc.pontos}`);
  assert.match(orc.detalhe, /custos/);
});

test("tolerância de 5% evita oscilar por centavos", () => {
  // Custo 3% acima da meta ainda conta como dentro.
  const r = scoreSaudeFinanceira({ ...MES_BOM, custos: 420000 * 1.03 });
  assert.equal(r.componentes.find((c) => c.id === "orcamento").pontos, 25);
});

test("conta vencida derruba o componente de contas", () => {
  const r = scoreSaudeFinanceira({ ...MES_BOM, contasVencidas: 4, contasTotal: 8 });
  const c = r.componentes.find((c) => c.id === "contas");
  assert.equal(c.pontos, 10, "metade vencida, metade dos pontos");
  assert.match(c.detalhe, /4 de 8/);
});

test("lançamento pendente ou sem categoria derruba a organização", () => {
  const r = scoreSaudeFinanceira({
    ...MES_BOM, lancamentosPendentes: 3, lancamentosSemConta: 3, lancamentosTotal: 30,
  });
  const c = r.componentes.find((c) => c.id === "organizacao");
  assert.equal(c.pontos, 12, "20% com problema -> 80% dos 15 pontos");
  assert.match(c.detalhe, /6 de 30/);
});

test("carro vendido no prejuízo aparece na margem", () => {
  const r = scoreSaudeFinanceira({ ...MES_BOM, veiculosVendidos: 4, veiculosComLucro: 1 });
  const c = r.componentes.find((c) => c.id === "margem");
  assert.equal(c.pontos, 3);
  assert.match(c.detalhe, /1 de 4/);
});

test("todo componente sempre explica o próprio número", () => {
  for (const dados of [MES_BOM, {}, { ...MES_BOM, lucroLiquido: -1 }]) {
    for (const c of scoreSaudeFinanceira(dados).componentes) {
      assert.ok(c.detalhe && c.detalhe.length > 5, `${c.id} sem explicação`);
      assert.ok(c.rotulo, `${c.id} sem rótulo`);
      assert.equal(typeof c.max, "number");
    }
  }
});

test("score nunca sai da faixa de 0 a 100", () => {
  const extremos = [
    MES_BOM,
    {},
    { ...MES_BOM, lucroLiquido: -999999, contasVencidas: 99, contasTotal: 99 },
    { receita: 1, lucroLiquido: 1, veiculosVendidos: 1, veiculosComLucro: 1 },
  ];
  for (const d of extremos) {
    const { score } = scoreSaudeFinanceira(d);
    if (score === null) continue;
    assert.ok(score >= 0 && score <= 100, `score fora da faixa: ${score}`);
  }
});

test("faixas em português cobrem a escala inteira", () => {
  assert.equal(faixaSaude(100).rotulo, "saudável");
  assert.equal(faixaSaude(80).rotulo, "saudável");
  assert.equal(faixaSaude(79).rotulo, "atenção");
  assert.equal(faixaSaude(60).rotulo, "atenção");
  assert.equal(faixaSaude(59).rotulo, "crítico");
  assert.equal(faixaSaude(0).rotulo, "crítico");
});

// --- Veredito exige base (14/08/2026) ---------------------------------------
// Em produção o score deu 43 e a tela chamou a loja de "crítica" — com dois
// componentes avaliados, por causa de uma única conta vencida. O número estava
// certo; o veredito, não.

test("com menos de três itens avaliados, não há veredito", () => {
  const f = faixaSaude(43, 2);
  assert.equal(f.rotulo, "avaliação parcial");
  assert.equal(f.parcial, true);
});

test("um item avaliado também não dá veredito, nem o melhor caso", () => {
  assert.equal(faixaSaude(100, 1).parcial, true);
  assert.equal(faixaSaude(0, 1).parcial, true);
});

test("com base suficiente, o veredito volta", () => {
  assert.equal(faixaSaude(90, MINIMO_PARA_VEREDITO).rotulo, "saudável");
  assert.equal(faixaSaude(43, 5).rotulo, "crítico");
  assert.equal(faixaSaude(43, 5).parcial, false);
});

test("sem dados continua sem dados, independente da contagem", () => {
  assert.equal(faixaSaude(null, 5).rotulo, "sem dados");
  assert.equal(faixaSaude(null, 0).rotulo, "sem dados");
});
