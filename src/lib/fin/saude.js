/**
 * Score de saúde financeira (módulo Planejamento).
 *
 * O QUE ELE É: uma soma de verificações explicadas, não um índice de mercado.
 * Cada componente diz quantos pontos deu, de quantos podia dar, e POR QUÊ — a
 * tela mostra isso aberto. Um número de 0 a 100 sozinho não ajuda ninguém a
 * decidir nada; o que ajuda é "perdi 20 pontos porque tem conta vencida".
 *
 * A REGRA QUE MAIS IMPORTA AQUI: componente sem dado não vale zero, fica de
 * fora da conta. Se a loja ainda não cadastrou orçamento do ano, ela não é uma
 * empresa doente — ela é uma empresa sem orçamento cadastrado. Pontuar isso
 * como zero daria 45/100 para uma loja saudável e o número perderia serventia
 * no primeiro mês de uso, que é justamente quando ele seria olhado.
 *
 * Puro de propósito: sem banco e sem rede, para rodar em `node --test`.
 */

const PESOS = {
  resultado: 30,
  orcamento: 25,
  contas: 20,
  organizacao: 15,
  margem: 10,
};

const pct = (parte, total) => (total > 0 ? (parte / total) * 100 : 0);

/** Resultado do período: lucro líquido e o quanto ele representa da receita. */
function avaliaResultado({ receita, lucroLiquido }) {
  const r = Number(receita) || 0;
  const lucro = Number(lucroLiquido) || 0;
  if (r <= 0) {
    return { pontos: null, detalhe: "Sem receita lançada no período." };
  }
  const margem = pct(lucro, r);
  if (lucro <= 0) {
    return { pontos: 0, detalhe: `Prejuízo de ${margem.toFixed(1)}% sobre a receita.` };
  }
  // 10% de margem líquida já vale a nota cheia; abaixo disso, proporcional.
  const fracao = Math.min(1, margem / 10);
  return {
    pontos: Math.round(PESOS.resultado * fracao),
    detalhe: `Margem líquida de ${margem.toFixed(1)}%.`,
  };
}

/**
 * Aderência ao orçamento: receita não pode ficar muito abaixo da meta, custo e
 * despesa não podem estourar. Uma tolerância de 5% para cada lado evita que o
 * score oscile por centavos.
 */
function avaliaOrcamento({ receita, custos, despesas, receitaMeta, custoMeta, despesaMeta }) {
  const metas = [
    ["receita", Number(receitaMeta) || 0, Number(receita) || 0, "maior"],
    ["custos", Number(custoMeta) || 0, Number(custos) || 0, "menor"],
    ["despesas", Number(despesaMeta) || 0, Number(despesas) || 0, "menor"],
  ].filter(([, meta]) => meta > 0);

  if (!metas.length) {
    return { pontos: null, detalhe: "Sem orçamento cadastrado para o período." };
  }

  let ok = 0;
  const estouros = [];
  for (const [nome, meta, real, sentido] of metas) {
    const dentro = sentido === "maior" ? real >= meta * 0.95 : real <= meta * 1.05;
    if (dentro) ok += 1;
    else estouros.push(nome);
  }
  return {
    pontos: Math.round(PESOS.orcamento * (ok / metas.length)),
    detalhe: estouros.length
      ? `Fora da meta em: ${estouros.join(", ")}.`
      : "Dentro das metas do orçamento.",
  };
}

/** Contas a pagar vencidas e ainda não pagas. */
function avaliaContas({ contasVencidas, contasTotal }) {
  const vencidas = Number(contasVencidas) || 0;
  const total = Number(contasTotal) || 0;
  if (total <= 0) {
    return { pontos: null, detalhe: "Nenhuma conta a pagar no período." };
  }
  if (vencidas === 0) {
    return { pontos: PESOS.contas, detalhe: "Nenhuma conta vencida em aberto." };
  }
  const fracao = Math.max(0, 1 - pct(vencidas, total) / 100);
  return {
    pontos: Math.round(PESOS.contas * fracao),
    detalhe: `${vencidas} de ${total} conta(s) vencida(s) e em aberto.`,
  };
}

/** Lançamentos pendentes ou sem conta no plano — o mês não está confiável. */
function avaliaOrganizacao({ lancamentosPendentes, lancamentosSemConta, lancamentosTotal }) {
  const total = Number(lancamentosTotal) || 0;
  if (total <= 0) {
    return { pontos: null, detalhe: "Sem lançamentos no período." };
  }
  const problemas = (Number(lancamentosPendentes) || 0) + (Number(lancamentosSemConta) || 0);
  if (problemas === 0) {
    return { pontos: PESOS.organizacao, detalhe: "Todos os lançamentos confirmados e classificados." };
  }
  const fracao = Math.max(0, 1 - pct(problemas, total) / 100);
  return {
    pontos: Math.round(PESOS.organizacao * fracao),
    detalhe: `${problemas} de ${total} lançamento(s) pendente(s) ou sem categoria.`,
  };
}

/** Quantos carros vendidos deram resultado positivo. */
function avaliaMargem({ veiculosVendidos, veiculosComLucro }) {
  const vendidos = Number(veiculosVendidos) || 0;
  if (vendidos <= 0) {
    return { pontos: null, detalhe: "Nenhum veículo vendido com valores lançados." };
  }
  const comLucro = Number(veiculosComLucro) || 0;
  return {
    pontos: Math.round(PESOS.margem * (comLucro / vendidos)),
    detalhe: `${comLucro} de ${vendidos} veículo(s) vendido(s) deram lucro.`,
  };
}

const AVALIADORES = [
  ["resultado", "Resultado do período", avaliaResultado],
  ["orcamento", "Aderência ao orçamento", avaliaOrcamento],
  ["contas", "Contas a pagar em dia", avaliaContas],
  ["organizacao", "Organização dos lançamentos", avaliaOrganizacao],
  ["margem", "Margem dos veículos vendidos", avaliaMargem],
];

/** Abaixo disto o score existe, mas não sustenta um veredito sobre a empresa. */
export const MINIMO_PARA_VEREDITO = 3;

/**
 * Faixa em português — é assim que a tela fala, não em número solto.
 *
 * `avaliados` não é enfeite: com dois componentes, uma única conta vencida
 * derruba o score para 43 e a loja é chamada de "crítica" sem que ninguém
 * tenha olhado receita, orçamento ou margem. Nesse caso o número continua
 * aparecendo — ele é verdadeiro — mas sem veredito, porque o veredito seria
 * falso. Visto em produção em 14/08/2026.
 */
export function faixaSaude(score, avaliados = MINIMO_PARA_VEREDITO) {
  if (score === null) return { rotulo: "sem dados", cor: "#888", parcial: false };
  if (avaliados < MINIMO_PARA_VEREDITO) {
    return { rotulo: "avaliação parcial", cor: "#666", parcial: true };
  }
  if (score >= 80) return { rotulo: "saudável", cor: "#15803d", parcial: false };
  if (score >= 60) return { rotulo: "atenção", cor: "#a8752e", parcial: false };
  return { rotulo: "crítico", cor: "#b91c1c", parcial: false };
}

/**
 * Calcula o score. Devolve `score` de 0 a 100 (ou null quando nada pôde ser
 * avaliado) e a lista de componentes, cada um com pontos, máximo e explicação.
 *
 * O score é reescalado sobre os componentes AVALIADOS — ver o comentário do
 * topo. `avaliados`/`total` dizem quantos entraram, para a tela poder avisar
 * que o número está apoiado em pouca coisa.
 */
export function scoreSaudeFinanceira(dados = {}) {
  const componentes = AVALIADORES.map(([id, rotulo, fn]) => {
    const r = fn(dados);
    return {
      id,
      rotulo,
      pontos: r.pontos,
      max: PESOS[id],
      detalhe: r.detalhe,
      avaliado: r.pontos !== null,
    };
  });

  const avaliados = componentes.filter((c) => c.avaliado);
  if (!avaliados.length) {
    return { score: null, componentes, avaliados: 0, total: componentes.length };
  }

  const obtidos = avaliados.reduce((s, c) => s + c.pontos, 0);
  const possiveis = avaliados.reduce((s, c) => s + c.max, 0);
  return {
    score: Math.round(pct(obtidos, possiveis)),
    componentes,
    avaliados: avaliados.length,
    total: componentes.length,
  };
}
