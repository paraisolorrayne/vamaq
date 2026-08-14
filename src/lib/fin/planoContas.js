/**
 * Regras do plano de contas: onde uma categoria nova entra e que código recebe.
 *
 * POR QUE ISTO EXISTE: a Mayra precisava de sete categorias de despesa que não
 * existiam (material de escritório, lava jato, brindes...) e vai precisar de
 * outras que ninguém previu. Sem um lugar para criar, cada categoria nova vira
 * pedido de desenvolvimento — e enquanto não chega, a despesa entra na conta
 * errada e o DRE mente.
 *
 * O código não é enfeite: o DRE e a margem por veículo agrupam POR PREFIXO
 * (ver fin/calc.js e o `code like '4.1%'` do custo de aquisição). Categoria
 * criada no grupo errado aparece no lugar errado do resultado, então quem cria
 * escolhe o GRUPO em português e o código sai daqui — a operadora nunca digita
 * "5.1.7".
 *
 * Puro de propósito: sem banco e sem rede, para rodar em `node --test`.
 */

/**
 * Os grupos que a tela oferece. `prefixo` é onde a conta nasce; `tipo` decide
 * se ela é receita ou despesa no DRE.
 *
 * 4.1 NÃO está aqui de propósito: é o custo de aquisição do veículo, casado
 * com `code like '4.1%'` no cálculo da margem. Deixar a operadora criar conta
 * embaixo dele faria uma despesa qualquer virar "preço de compra do carro" e
 * bagunçar a margem de todo veículo ligado a ela.
 */
export const GRUPOS = [
  {
    id: "custo-veiculo",
    rotulo: "Custos do veículo",
    ajuda: "Gastos que pertencem a um carro — entram na margem dele. Ex.: lava jato, chaveiro, funilaria.",
    prefixo: "4.2",
    tipo: "expense",
  },
  {
    id: "administrativa",
    rotulo: "Despesas administrativas",
    ajuda: "O custo de manter a loja aberta. Ex.: material de escritório, limpeza, alimentação.",
    prefixo: "5.1",
    tipo: "expense",
  },
  {
    id: "comercial",
    rotulo: "Despesas comerciais",
    ajuda: "Gastos para vender. Ex.: marketing, brindes, comissão.",
    prefixo: "5.2",
    tipo: "expense",
  },
  {
    id: "financeira",
    rotulo: "Despesas financeiras",
    ajuda: "Custos de dinheiro. Ex.: juros, tarifa de banco, taxa de maquininha.",
    prefixo: "5.3",
    tipo: "expense",
  },
  { id: "imposto", rotulo: "Impostos", ajuda: "Tributos sobre a operação.", prefixo: "5.4", tipo: "expense" },
  { id: "receita", rotulo: "Receitas", ajuda: "Dinheiro que entra na loja.", prefixo: "3", tipo: "revenue" },
];

export function grupoPorId(id) {
  return GRUPOS.find((g) => g.id === id) || null;
}

const CODIGO_NUMERICO = /^\d+(\.\d+)*$/;

/** "5.1.10" -> [5,1,10]; código não numérico -> null. */
export function partesDoCodigo(code) {
  const c = String(code ?? "").trim();
  if (!CODIGO_NUMERICO.test(c)) return null;
  return c.split(".").map(Number);
}

/**
 * Ordem natural: 5.1.2 vem ANTES de 5.1.10.
 *
 * Ordenar código como texto põe "5.1.10" entre "5.1.1" e "5.1.2" — some da
 * vista de quem procura, e a lista parece embaralhada assim que passa de nove
 * contas num grupo. Código não numérico vai para o fim, ordenado por nome.
 */
export function ordenaContas(contas) {
  return [...(contas || [])].sort((a, b) => {
    const pa = partesDoCodigo(a?.code);
    const pb = partesDoCodigo(b?.code);
    if (pa && !pb) return -1;
    if (!pa && pb) return 1;
    if (pa && pb) {
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] ?? -1) - (pb[i] ?? -1);
        if (d !== 0) return d;
      }
    }
    return String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "pt-BR");
  });
}

/**
 * Próximo código livre dentro de um grupo.
 *
 * Considera só os filhos DIRETOS do prefixo: em "5.1", olha 5.1.1 … 5.1.9 e
 * ignora 5.1.3.2, senão um dia o contador cria um nível a mais e o próximo
 * código sai de um ramo que não é o nosso.
 *
 * Nunca reaproveita código de conta apagada: conta desativada continua no
 * histórico dos lançamentos, e reciclar o código faria dois significados
 * diferentes dividirem o mesmo número no DRE de meses distintos.
 */
export function proximoCodigo(prefixo, contasExistentes) {
  const base = partesDoCodigo(prefixo);
  if (!base) return null;

  let maior = 0;
  for (const c of contasExistentes || []) {
    const partes = partesDoCodigo(c?.code);
    if (!partes || partes.length !== base.length + 1) continue;
    if (base.some((n, i) => partes[i] !== n)) continue;
    const ultimo = partes[partes.length - 1];
    if (ultimo > maior) maior = ultimo;
  }
  return `${prefixo}.${maior + 1}`;
}

/** Nome de categoria aceitável: sem vazio, sem duplicata dentro do mesmo grupo. */
export function validaNomeConta(nome, grupo, contasExistentes) {
  const limpo = String(nome ?? "").trim().replace(/\s+/g, " ");
  if (limpo.length < 2) return { error: "Dê um nome à categoria." };
  if (limpo.length > 60) return { error: "Nome muito longo (máximo 60 caracteres)." };
  if (!grupo) return { error: "Escolha onde a categoria entra." };

  const chave = (t) => String(t ?? "").trim().toLowerCase();
  const irmas = (contasExistentes || []).filter((c) => {
    const partes = partesDoCodigo(c?.code);
    const base = partesDoCodigo(grupo.prefixo);
    return partes && base && partes.length === base.length + 1 && base.every((n, i) => partes[i] === n);
  });
  if (irmas.some((c) => chave(c.name) === chave(limpo))) {
    return { error: `Já existe "${limpo}" em ${grupo.rotulo}.` };
  }
  return { nome: limpo };
}
