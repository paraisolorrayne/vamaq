/**
 * Fórmulas financeiras puras (DRE, margens) — ADR-001c §1.
 *
 * Sem dependências e sem I/O: recebe lançamentos já enriquecidos com o código
 * da conta e devolve os números. Isso mantém a regra de negócio testável (o
 * financeiro roda em JS puro, sem TypeScript — os testes seguram o dinheiro).
 *
 * Convenção do plano de contas (concessionária):
 *   - receita   = type 'revenue'            (contas 3.x)
 *   - custo/CMV = type 'expense' com code começando em '4'  (4.x)
 *   - despesa   = type 'expense' com o restante             (5.x, ou sem code)
 *
 * Só entram lançamentos 'confirmed' ou 'reconciled' (pending fica de fora).
 */

const CONTA_NUMBERS = new Set(["confirmed", "reconciled"]);

function isCMV(tx) {
  return tx.type === "expense" && String(tx.code || "").trim().startsWith("4");
}

/**
 * @param {Array<{type:string, amount:number|string, code?:string, status?:string}>} transactions
 * @returns {{receita:number, custos:number, despesas:number, lucroBruto:number,
 *   lucroLiquido:number, margemBruta:number, margemOperacional:number}}
 */
export function computeDRE(transactions) {
  let receita = 0;
  let custos = 0;
  let despesas = 0;

  for (const tx of transactions || []) {
    if (tx.status && !CONTA_NUMBERS.has(tx.status)) continue;
    const amount = Number(tx.amount) || 0;
    if (tx.type === "revenue") receita += amount;
    else if (isCMV(tx)) custos += amount;
    else if (tx.type === "expense") despesas += amount;
  }

  const lucroBruto = receita - custos;
  const lucroLiquido = lucroBruto - despesas;

  return {
    receita: round2(receita),
    custos: round2(custos),
    despesas: round2(despesas),
    lucroBruto: round2(lucroBruto),
    lucroLiquido: round2(lucroLiquido),
    // Margens em % (0 quando não há receita, para não dividir por zero).
    margemBruta: receita > 0 ? round2((lucroBruto / receita) * 100) : 0,
    margemOperacional: receita > 0 ? round2((lucroLiquido / receita) * 100) : 0,
  };
}

/** Margem de um único veículo a partir dos seus lançamentos. */
export function computeVehicleMargin(transactions) {
  let receita = 0;
  let custo = 0;
  for (const tx of transactions || []) {
    if (tx.status && !CONTA_NUMBERS.has(tx.status)) continue;
    const amount = Number(tx.amount) || 0;
    if (tx.type === "revenue") receita += amount;
    else if (tx.type === "expense") custo += amount;
  }
  return {
    receita: round2(receita),
    custo: round2(custo),
    resultado: round2(receita - custo),
    margem: receita > 0 ? round2(((receita - custo) / receita) * 100) : 0,
  };
}

/**
 * ICMS do seminovo (Lucro Presumido, contador da Vamaq): base = lucro
 * (venda − compra de aquisição), alíquota padrão 5%. Só incide quando há venda
 * e o lucro é positivo. Retorna o valor do ICMS.
 */
export function icmsSeminovo(receita, custoAquisicao, aliquota = 5) {
  const r = Number(receita) || 0;
  const c = Number(custoAquisicao) || 0;
  if (r <= 0) return 0;
  const base = Math.max(0, r - c);
  return round2((base * (Number(aliquota) || 0)) / 100);
}

/**
 * Alçada de aprovação (Contas a Pagar — ADR-001c §2, correção #1: imposta na
 * camada de servidor, não só no hook). admin é sempre ilimitado; os demais
 * aprovam até o próprio approval_limit (null = 0, precisa de aprovação).
 */
export function podeAprovar(user, value) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const limit = Number(user.approval_limit) || 0;
  return Number(value) <= limit;
}

export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
