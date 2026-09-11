/**
 * O PDF da "Lista de Veículos na Loja" — o que o vendedor manda pro cliente.
 *
 * DESENHO: tabela de grade fechada, uma linha por carro, em A4 DEITADO. As
 * nove colunas não cabem em pé sem espremer Descrição e Opcionais, que são
 * justamente as duas que o cliente lê.
 *
 * A faixa do topo (logo, título, página e data) só existe na PRIMEIRA página;
 * o cabeçalho da TABELA se repete em todas, senão a segunda folha vira um
 * bloco de números sem nome de coluna. O total fecha a última.
 *
 * As regras de conteúdo — quem entra, ordem, formato de cada coluna — estão em
 * `listaVeiculos.js`, com teste. Aqui só se posiciona o que já veio pronto.
 */

import { loadVamaqLogo } from "../contractPdf.js";
import { linhasDaLista, paginar } from "./listaVeiculos.js";

// --- Geometria A4 deitado (mm) ---
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 10;
const CONTENT_W = PAGE_W - MARGIN * 2; // 277

// Altura da faixa de título (só na primeira página).
const FAIXA_H = 22;
const ROW_H = 4.8;
const HEAD_H = 6.5;

const INK = [17, 17, 17];
const BORDER = [120, 120, 126];

/**
 * As colunas, na ordem do modelo e sem "Codigo" — a Vamaq não tem um código
 * interno de veículo, e inventar um número que muda a cada exportação seria
 * pior que não ter a coluna (decisão da Lorrayne, 11/09/2026).
 *
 * `align` só muda onde o modelo alinha diferente: valor à direita, e os campos
 * numéricos curtos centralizados.
 */
const COLUNAS = [
  { key: "seq", titulo: "Seq", w: 10, align: "center" },
  { key: "descricao", titulo: "Descrição_Produto", w: 66 },
  { key: "anoModelo", titulo: "Ano/Model", w: 22, align: "center" },
  { key: "cor", titulo: "Cor", w: 28 },
  { key: "placa", titulo: "Placa", w: 24 },
  { key: "opcionais", titulo: "Opcionais", w: 60 },
  { key: "km", titulo: "KM", w: 21 },
  { key: "qtdDias", titulo: "Qtd dias", w: 19, align: "center" },
  { key: "valor", titulo: "Vlr de Venda", w: 27, align: "right" },
];

/** "11/09/2026 14.23.53" — o carimbo do canto, no formato do modelo. */
function carimbo(agora) {
  const d = (n) => String(n).padStart(2, "0");
  return (
    `${d(agora.getDate())}/${d(agora.getMonth() + 1)}/${agora.getFullYear()} ` +
    `${d(agora.getHours())}.${d(agora.getMinutes())}.${d(agora.getSeconds())}`
  );
}

/** "2026-09-11" no fuso de quem está olhando — a referência de "Qtd dias". */
function hojeLocal(agora) {
  const d = (n) => String(n).padStart(2, "0");
  return `${agora.getFullYear()}-${d(agora.getMonth() + 1)}-${d(agora.getDate())}`;
}

/**
 * Baixa a lista de estoque em PDF.
 *
 * @param {Array} veiculos  como vêm de /api/admin/vehicles
 */
export async function exportarListaPdf(veiculos, opts = {}) {
  const doc = await buildListaDoc(veiculos, opts);
  const agora = opts.agora ?? new Date();
  doc.save(`Lista_de_Veiculos_${hojeLocal(agora)}.pdf`);
  return doc.output("blob");
}

/** Monta o documento sem salvar — separado para permitir inspeção e teste. */
export async function buildListaDoc(veiculos, opts = {}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const agora = opts.agora ?? new Date();
  const linhas = linhasDaLista(veiculos, { hoje: hojeLocal(agora) });
  const paginas = paginar(linhas);
  const logo = opts.logo ?? (await loadVamaqLogo("/images/vamaq-logo-on-light.svg"));

  const setText = (rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setDraw = (rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

  paginas.forEach((pagina, i) => {
    if (i > 0) doc.addPage();
    let y = MARGIN;

    if (i === 0) {
      desenhaFaixa(doc, { logo, agora, totalPaginas: paginas.length, y });
      y += FAIXA_H;
    }

    y = desenhaCabecalho(doc, y, { setText, setDraw });

    pagina.forEach((linha) => {
      desenhaLinha(doc, y, linha, { setText, setDraw });
      y += ROW_H;
    });

    // O total fecha a última folha, logo abaixo da grade — como no modelo.
    if (i === paginas.length - 1) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      setText(INK);
      doc.text(`Total de Veiculos:      ${linhas.length}`, MARGIN, y + 5);
    }
  });

  return doc;
}

function desenhaFaixa(doc, { logo, agora, totalPaginas, y }) {
  doc.setFont("helvetica", "normal");

  if (logo?.dataUrl) {
    // Altura fixa; a largura acompanha a proporção da marca.
    const h = 12;
    doc.addImage(logo.dataUrl, "PNG", MARGIN, y + 1, h * (logo.aspect || 3), h);
  } else {
    // Sem browser para rasterizar o SVG, o nome entra como wordmark — melhor
    // que um retângulo vazio no topo do documento que vai para o cliente.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text("VAMAQ", MARGIN, y + 9);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(17);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Lista de Veículos na Loja", PAGE_W / 2, y + 9, { align: "center" });

  doc.setFontSize(7);
  const xDireita = PAGE_W - MARGIN;
  doc.text(`Pagina 1 de ${totalPaginas}`, xDireita, y + 4, { align: "right" });
  doc.text(carimbo(agora), xDireita, y + 9, { align: "right" });
}

function desenhaCabecalho(doc, y, { setText, setDraw }) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setText(INK);
  setDraw(BORDER);
  doc.setLineWidth(0.2);

  let x = MARGIN;
  COLUNAS.forEach((col) => {
    doc.rect(x, y, col.w, HEAD_H);
    // O título da coluna segue o alinhamento do conteúdo, senão "Vlr de Venda"
    // fica à esquerda de números que estão à direita.
    escreve(doc, col.titulo, x, y + HEAD_H - 2, col);
    x += col.w;
  });

  return y + HEAD_H;
}

function desenhaLinha(doc, y, linha, { setText, setDraw }) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setText(INK);
  setDraw(BORDER);
  doc.setLineWidth(0.15);

  let x = MARGIN;
  COLUNAS.forEach((col) => {
    doc.rect(x, y, col.w, ROW_H);
    const valor = linha[col.key];
    escreve(doc, valor === 0 ? "0" : String(valor ?? ""), x, y + ROW_H - 1.5, col);
    x += col.w;
  });
}

/**
 * Escreve uma célula respeitando a largura da coluna.
 *
 * Texto que não cabe é CORTADO, não quebrado em duas linhas: a grade tem
 * altura fixa de uma linha, e deixar quebrar faria a segunda linha invadir a
 * célula de baixo — o defeito aparece só no carro de nome comprido, que é
 * justamente o importado caro.
 */
function escreve(doc, texto, x, y, col) {
  const PAD = 1.2;
  const disponivel = col.w - PAD * 2;
  let t = texto ?? "";
  while (t.length > 1 && doc.getTextWidth(t) > disponivel) t = t.slice(0, -1);

  if (col.align === "right") doc.text(t, x + col.w - PAD, y, { align: "right" });
  else if (col.align === "center") doc.text(t, x + col.w / 2, y, { align: "center" });
  else doc.text(t, x + PAD, y);
}
