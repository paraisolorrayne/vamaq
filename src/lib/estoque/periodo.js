/**
 * Filtro por período do estoque: quais carros entraram (ou saíram) entre duas
 * datas.
 *
 * POR QUE ISTO É UM MÓDULO E NÃO TRÊS LINHAS NA TELA: comparar data em
 * JavaScript é uma armadilha conhecida. `new Date("2026-08-14")` é interpretado
 * como UTC meia-noite, e em Uberlândia (UTC-3) isso vira 13/08 às 21h — um
 * carro que entrou no dia 14 some de um filtro "de 14 até 14". As datas aqui
 * são strings "AAAA-MM-DD" comparadas como texto, que para esse formato é
 * exatamente a ordem cronológica e não tem fuso nenhum envolvido.
 *
 * Puro de propósito: sem banco e sem rede, para rodar em `node --test`.
 */

const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normaliza o que vier para "AAAA-MM-DD", ou null quando não dá para confiar.
 *
 * Aceita o que o Postgres devolve (`Date`, quando a coluna é `date`) e o que o
 * `<input type="date">` manda (string). Corta o horário de um ISO completo em
 * vez de convertê-lo: converter é o que traz o fuso de volta.
 */
export function normalizaData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    // getUTC*: a coluna é `date`, o driver monta meia-noite UTC, e usar os
    // getters locais devolveria o dia anterior a oeste de Greenwich.
    const mes = String(valor.getUTCMonth() + 1).padStart(2, "0");
    const dia = String(valor.getUTCDate()).padStart(2, "0");
    return `${valor.getUTCFullYear()}-${mes}-${dia}`;
  }
  const texto = String(valor).trim();
  if (SO_DATA.test(texto)) return texto;
  const inicio = texto.slice(0, 10);
  return SO_DATA.test(inicio) ? inicio : null;
}

/** Data dentro do intervalo, com as duas pontas INCLUÍDAS. */
export function dentroDoPeriodo(data, de, ate) {
  const d = normalizaData(data);
  if (!d) return false;
  const inicio = normalizaData(de);
  const fim = normalizaData(ate);
  if (inicio && d < inicio) return false;
  if (fim && d > fim) return false;
  return true;
}

/**
 * Filtra veículos por período.
 *
 * `campo` é "data_entrada" ou "data_saida". Sem nenhuma das pontas preenchidas
 * a lista volta inteira — filtro vazio não pode esconder carro.
 *
 * Carro sem a data preenchida fica DE FORA quando há período: os 43 carros que
 * já estavam no estoque quando o campo foi criado não têm data de entrada, e
 * incluí-los em todo período faria o relatório mentir para os dois lados.
 */
export function filtraPorPeriodo(veiculos, { de, ate, campo = "data_entrada" } = {}) {
  const lista = veiculos || [];
  const inicio = normalizaData(de);
  const fim = normalizaData(ate);
  if (!inicio && !fim) return [...lista];
  return lista.filter((v) => dentroDoPeriodo(v?.[campo], inicio, fim));
}

/**
 * Quantos carros do conjunto ainda não têm a data preenchida.
 *
 * A tela mostra este número junto do filtro: sem ele, um período que devolve
 * poucos carros parece um mês fraco de vendas, quando na verdade é cadastro
 * incompleto. É a diferença entre "vendemos 2" e "2 dos 45 têm data".
 */
export function semData(veiculos, campo = "data_entrada") {
  return (veiculos || []).filter((v) => !normalizaData(v?.[campo])).length;
}
