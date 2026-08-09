/**
 * Opções do <select> de origem no formulário de oportunidade (nova/editar).
 *
 * `origem` é texto livre no banco (sem CHECK) — se a oportunidade já tem um
 * valor gravado que não está na lista fixa (dado antigo, ou gravado por
 * outra via), um <select> comum cairia na primeira opção da lista e salvar
 * trocaria o valor em silêncio, sem a pessoa notar. `opcoesOrigem` garante
 * que o valor atual sempre aparece como opção, mesmo fora da lista, e nunca
 * duplica quando ele já está nela.
 *
 * Puro de propósito (sem I/O e sem imports): usado pelo FormOportunidade e
 * direto no teste, que roda em `node --test`, onde o alias "@/" não resolve.
 */
export const ORIGENS = ["WhatsApp", "Instagram", "Indicação", "Site", "Loja física", "Outro"];

export function opcoesOrigem(origemAtual) {
  return origemAtual && !ORIGENS.includes(origemAtual) ? [...ORIGENS, origemAtual] : ORIGENS;
}
