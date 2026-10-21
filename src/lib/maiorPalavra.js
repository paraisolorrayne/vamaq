/**
 * Quantas letras tem a palavra mais longa do nome — "X6 M Competition" → 11.
 *
 * Existe para o título do modelo caber na coluna sem quebrar no meio da
 * palavra. O CSS só sabe a largura da coluna; o tamanho da fonte que cabe
 * depende também da palavra mais comprida, e isso só o texto sabe. A tela
 * passa este número como `--letras` e o CSS divide a largura por ele.
 *
 * Antes disso, o título ficava num tamanho fixo e `overflow-wrap: break-word`
 * (global em h1–h6) cortava a palavra que não cabia: "COMPETITIO / N" na
 * página do carro e "CARRER / A S" no destaque da home, no celular.
 *
 * Puro de propósito (sem imports): roda no servidor, no cliente e no teste.
 */

export function letrasDaMaiorPalavra(texto) {
  const palavras = String(texto ?? '').trim().split(/\s+/);
  // Nunca menos que 1: o número vai para o divisor de um calc() no CSS.
  return Math.max(1, ...palavras.map((p) => p.length));
}
