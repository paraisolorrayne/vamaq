/**
 * Série de contas mensais (água, luz, internet, aluguel).
 *
 * A DECISÃO DE PROJETO: a série é GERADA NA HORA, com todas as parcelas
 * visíveis na lista. Não há tarefa agendada criando conta de madrugada.
 *
 * O motivo é honestidade operacional: agendador que falha, falha calado — e
 * ninguém descobre que a conta de setembro não nasceu até ela vencer. Com a
 * série na tela, a secretária vê as doze linhas e sabe que existem.
 *
 * O VALOR de cada parcela é uma PREVISÃO. Conta de água não vem igual todo
 * mês, então a tela deixa editar cada uma quando a conta real chega. Isso é
 * seguro porque conta a pagar não entra no DRE — quem entra é o lançamento
 * do pagamento. Uma previsão errada não suja o resultado do mês.
 *
 * Puro de propósito: sem banco e sem rede, para rodar em `node --test`.
 */

const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

export const MAX_PARCELAS = 24;

/** Último dia do mês (1-12), com ano bissexto. */
export function ultimoDiaDoMes(ano, mes) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * Datas de vencimento de uma série mensal.
 *
 * A ARMADILHA: vencimento dia 31 em janeiro. Somar "um mês" ingenuamente leva
 * a 31/02, que o JavaScript empurra silenciosamente para 03/03. E derivar cada
 * mês do anterior propaga o encolhimento: 31/01 → 28/02 → 28/03, quando o
 * certo é 31/03. Por isso o dia original é guardado e reaplicado a cada mês,
 * limitado ao último dia daquele mês.
 */
export function datasDaSerie(primeiroVencimento, parcelas) {
  const inicio = String(primeiroVencimento ?? "").trim();
  if (!SO_DATA.test(inicio)) return [];

  const n = Math.floor(Number(parcelas) || 0);
  if (n < 1) return [];
  const total = Math.min(n, MAX_PARCELAS);

  const [ano, mes, dia] = inicio.split("-").map(Number);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return [];

  const datas = [];
  for (let i = 0; i < total; i++) {
    const bruto = mes - 1 + i;
    const anoAlvo = ano + Math.floor(bruto / 12);
    const mesAlvo = (bruto % 12) + 1;
    const diaAlvo = Math.min(dia, ultimoDiaDoMes(anoAlvo, mesAlvo));
    datas.push(
      `${anoAlvo}-${String(mesAlvo).padStart(2, "0")}-${String(diaAlvo).padStart(2, "0")}`
    );
  }
  return datas;
}

/**
 * Descrição de cada parcela. "Conta de água" vira "Conta de água (1/12)" — sem
 * isso a lista fica com doze linhas idênticas e ninguém sabe qual já pagou.
 * Série de uma parcela só não ganha sufixo: não é série.
 */
export function descricaoDaParcela(descricao, indice, total) {
  const base = String(descricao ?? "").trim();
  if (!base) return "";
  if (!total || total < 2) return base;
  return `${base} (${indice + 1}/${total})`;
}
