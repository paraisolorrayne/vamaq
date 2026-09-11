/**
 * As linhas da lista de veículos em estoque, no formato que a loja exporta.
 *
 * Uma linha por carro à venda, com o texto de cada coluna já pronto — quem
 * desenha o PDF só posiciona. Separado do desenho de propósito: as regras
 * abaixo (quem entra, em que ordem, o que é branco) são o que erra, e elas
 * cabem em teste sem abrir um PDF.
 *
 * Puro de propósito: sem banco, sem rede e sem alias "@/", para rodar direto
 * em `node --test`.
 */

import { normalizaData } from "./periodo.js";

// Só o que está à venda hoje. Reservado já tem dono e vendido saiu do pátio —
// mandar qualquer um dos dois para um cliente é oferecer o que não existe.
const STATUS_NA_LISTA = "disponivel";

const MILHAR = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const REAIS = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function texto(valor) {
  return typeof valor === "string" ? valor.trim() : valor == null ? "" : String(valor);
}

/** "PORSCHE 911 CARRERA" — marca e modelo numa coluna só, como no modelo. */
function descricaoDoProduto(v) {
  return [texto(v.brand), texto(v.model)].filter(Boolean).join(" ").toUpperCase();
}

/**
 * "2025/2026" — sempre os dois anos.
 *
 * A tela usa `anoVeiculo`, que colapsa "2026/2026" em "2026" porque repetir na
 * ficha é ruído. Aqui a coluna se chama "Ano/Model" e a lista é lida em
 * varredura, coluna por coluna: uma linha com um ano só quebra o alinhamento
 * visual das outras oitenta.
 */
function anoModeloDaLista(v) {
  const fabricacao = Number(v.year) || 0;
  if (!fabricacao) return "";
  const modelo = Number(v.ano_modelo) || fabricacao;
  return `${fabricacao}/${modelo}`;
}

/** "BLINDADO CARBON" — a marca da blindagem entra junto quando cadastrada. */
function opcionaisDaLista(v) {
  if (!v.blindagem?.blindado) return "";
  const tipo = texto(v.blindagem.tipo).toUpperCase();
  return tipo ? `BLINDADO ${tipo}` : "BLINDADO";
}

/**
 * Há quantos dias o carro está no pátio.
 *
 * Datas comparadas como "AAAA-MM-DD" em UTC: `new Date("2026-08-22")` é
 * meia-noite UTC, que em Uberlândia é o dia 21 às 21h — a conta erraria um dia
 * em todo carro. Mesma armadilha que o filtro por período já documenta.
 */
function diasNoPatio(v, hoje) {
  const entrada = normalizaData(v.data_entrada);
  const referencia = normalizaData(hoje);
  // Sem data de entrada não há conta a fazer, e "0" se leria como "entrou
  // hoje". Ausência tem que aparecer como ausência.
  if (!entrada || !referencia) return "";
  const DIA = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(`${referencia}T00:00:00Z`) - Date.parse(`${entrada}T00:00:00Z`)) / DIA);
}

/** "40.500", "0km" ou branco — zero rodado é informação, zero ausente não. */
function kmDaLista(v) {
  const km = v.quilometragem;
  if (km === null || km === undefined || km === "") return "";
  const n = Number(km);
  if (!Number.isFinite(n)) return "";
  return n === 0 ? "0km" : MILHAR.format(n);
}

/**
 * "1.029.000,00" — sem "R$", que já está no título da coluna.
 *
 * Carro sem preço sai BRANCO, nunca "0,00": a lista vai para o cliente, e um
 * zero ali se lê como carro de graça. É a mesma decisão da tela de entradas e
 * saídas.
 */
function valorDaLista(v) {
  const preco = v.price;
  if (preco === null || preco === undefined || preco === "") return "";
  const n = Number(preco);
  return Number.isFinite(n) && n > 0 ? REAIS.format(n) : "";
}

/**
 * Quantas linhas cabem por folha.
 *
 * Conferido contra o modelo impresso: a primeira página traz 33 carros e as
 * seguintes 36 — a diferença é a faixa do topo, com logo, título e data, que
 * só existe na primeira. Mudou a altura do cabeçalho no PDF? Estes números
 * mudam junto, senão a última linha da página sai cortada pela margem.
 */
export const LINHAS_PRIMEIRA_PAGINA = 33;
export const LINHAS_DEMAIS_PAGINAS = 36;

/** Fatia as linhas em páginas, sem perder nem repetir nenhuma. */
export function paginar(linhas) {
  const todas = Array.isArray(linhas) ? linhas : [];
  if (todas.length === 0) return [[]];

  const paginas = [todas.slice(0, LINHAS_PRIMEIRA_PAGINA)];
  for (let i = LINHAS_PRIMEIRA_PAGINA; i < todas.length; i += LINHAS_DEMAIS_PAGINAS) {
    paginas.push(todas.slice(i, i + LINHAS_DEMAIS_PAGINAS));
  }
  return paginas;
}

/**
 * Monta as linhas da lista, já filtradas, ordenadas e numeradas.
 *
 * @param {Array} veiculos  como vêm do estoque
 * @param {{hoje: string}} opts  data de referência da coluna "Qtd dias"
 */
export function linhasDaLista(veiculos, { hoje } = {}) {
  return (Array.isArray(veiculos) ? veiculos : [])
    .filter((v) => v && v.status === STATUS_NA_LISTA)
    .map((v) => ({
      descricao: descricaoDoProduto(v),
      anoModelo: anoModeloDaLista(v),
      cor: texto(v.color).toUpperCase(),
      placa: texto(v.placa).toUpperCase(),
      opcionais: opcionaisDaLista(v),
      km: kmDaLista(v),
      qtdDias: diasNoPatio(v, hoje),
      valor: valorDaLista(v),
    }))
    .sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"))
    .map((linha, i) => ({ seq: i + 1, ...linha }));
}
