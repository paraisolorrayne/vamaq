/**
 * O fechamento fiscal do mês: quantas notas e quanto, na divisão do contador.
 *
 * POR QUE EXISTE: no fim do mês o contador pede o total emitido de venda, de
 * compra e de consignação. A tela de notas mostra o valor de UMA nota por vez,
 * então a resposta saía somando na mão, abrindo nota por nota — trabalho que
 * erra sozinho e que ninguém consegue conferir depois.
 *
 * Funções puras, sem banco e sem rede, pelo mesmo motivo de `pacote.js`: a
 * decisão que elas tomam é de CLASSIFICAÇÃO, e classificação errada só aparece
 * do lado do contador, depois que o mês já foi fechado.
 */

/**
 * Os CFOP de entrada que dizem "isto é consignação, não compra".
 *
 * Mora aqui, e não em `notas.js`, porque `notas.js` importa o banco: a regra
 * que separa compra de consignação ficaria fora do alcance de um teste puro
 * justamente sendo a mais fácil de errar. `notas.js` importa desta casa.
 */
export const CFOP_CONSIGNACAO_RECEBIDA = ["1917", "2917"];

/**
 * As notas de um mês para efeito de total. $1 = ano, $2 = mês.
 *
 * MESMA JANELA do pacote de XMLs (ver SQL_NOTAS_DO_MES em pacote.js): o recorte
 * é por `created_at` contra o primeiro dia do mês, virando timestamptz no fuso
 * da sessão — America/Sao_Paulo (src/lib/pgTypes.js). Divergir daquela janela
 * faria o zip e o resumo falarem de conjuntos diferentes de notas, e a
 * conferência do contador nunca fecharia.
 *
 * O que MUDA em relação ao pacote: aqui não se exige `xml_url`. Lá o filtro faz
 * sentido — sem arquivo não há o que zipar. Aqui a pergunta é outra: a nota foi
 * emitida, tem valor, e conta no fechamento mesmo que o XML não tenha vindo.
 */
export const SQL_TOTAIS_DO_MES = `
  select n.operacao, n.cfop, n.status, n.valor
    from notas_fiscais n
   where n.created_at >= make_date($1, $2, 1)
     and n.created_at <  make_date($1, $2, 1) + interval '1 month'
`;

// A ordem é a da leitura do contador: o que saiu, o que entrou, e o que voltou.
const CAIXAS = [
  ["venda", "Venda (saída)"],
  ["compra", "Compra (entrada)"],
  ["consignacao", "Consignação (entrada)"],
  ["devolucao", "Devolução"],
];

/**
 * Em que caixa uma nota cai.
 *
 * Compra e consignação são as duas `operacao = 'entrada'`; só o CFOP as separa.
 * Operação desconhecida devolve null — a nota é ignorada no total em vez de
 * inflar uma caixa qualquer.
 */
function caixaDaNota(nota) {
  if (nota.operacao === "saida") return "venda";
  if (nota.operacao === "devolucao") return "devolucao";
  if (nota.operacao !== "entrada") return null;
  return CFOP_CONSIGNACAO_RECEBIDA.includes(String(nota.cfop))
    ? "consignacao"
    : "compra";
}

// `valor` é numeric no Postgres e chega como string; nulo é nota que nasceu
// sem valor gravado. Nos dois casos, somar direto daria NaN no relatório.
function comoNumero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/**
 * O resumo do mês a partir das notas cruas.
 *
 * SÓ NOTA AUTORIZADA SOMA. Cancelada e em processamento não existem para a
 * SEFAZ — entrariam num total que muda depois. Viram aviso com quantidade,
 * porque a cancelada é justamente o que explica um pulo na numeração, e a que
 * está em processamento avisa que o mês ainda não está fechado.
 *
 * As quatro linhas vêm sempre, mesmo zeradas: "compra: 0 notas" responde a
 * pergunta do contador; a ausência da linha deixa ele sem saber se foi zero ou
 * se o sistema não olhou.
 */
export function resumirNotas(notas) {
  const totais = new Map(CAIXAS.map(([chave]) => [chave, { quantidade: 0, valor: 0 }]));
  let canceladas = 0;
  let processando = 0;
  let comErro = 0;

  for (const nota of notas || []) {
    if (nota.status === "cancelada") {
      canceladas += 1;
      continue;
    }
    if (nota.status === "processando") {
      processando += 1;
      continue;
    }
    if (nota.status !== "autorizada") {
      comErro += 1;
      continue;
    }

    const caixa = caixaDaNota(nota);
    if (!caixa) continue;
    const acumulado = totais.get(caixa);
    acumulado.quantidade += 1;
    acumulado.valor += comoNumero(nota.valor);
  }

  return {
    linhas: CAIXAS.map(([chave, rotulo]) => ({ chave, rotulo, ...totais.get(chave) })),
    canceladas,
    processando,
    comErro,
  };
}
