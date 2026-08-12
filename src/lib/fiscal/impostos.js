/**
 * Impostos da NF-e de veículo usado (Vamaq — Lucro Presumido, MG).
 *
 * DE ONDE VÊM ESTAS CONTAS: não de interpretação da legislação, e sim da NF 12
 * da própria Vamaq, autorizada pela SEFAZ-MG sob o protocolo 131267805126821.
 * Venda de 157.500,00; a DANFE traz base de ICMS 7.500,15, ICMS 375,01,
 * PIS 46,31 e COFINS 213,75. As quatro linhas fecham ao centavo pela cadeia
 * abaixo, e o teste `tests/fiscal-impostos.test.mjs` prende exatamente esses
 * valores. Mudou aqui e o teste quebrou? A conta é que está errada.
 *
 *   base do ICMS   = venda × (100 − redução)      redução = 95,238%
 *   ICMS           = base do ICMS × alíquota      alíquota = 5%
 *   base PIS/COFINS= base do ICMS − ICMS
 *   PIS / COFINS   = essa base × 0,65% / 3%       (cumulativo)
 *
 * O QUE MUDOU E POR QUE IMPORTA: até 12/08/2026 o sistema calculava a base do
 * ICMS como `venda − custo de aquisição`. Na NF 12 isso daria 7.500,00 — e a
 * nota autorizada traz 7.500,15. Os 15 centavos são a prova de que o método é
 * percentual sobre o valor cheio, não subtração: se fosse a margem, daria
 * redondo. O custo de aquisição NÃO entra em nenhuma destas contas; ele aparece
 * só no texto das informações complementares (ver payload.js).
 *
 * Puro de propósito: sem banco e sem rede, para rodar em `node --test`.
 */
import { round2 } from "../fin/calc.js";

/** Valores da NF 12 autorizada. Servem de default quando fiscal_config é omissa. */
export const PADRAO_IMPOSTOS = {
  reducaoBaseIcms: 95.238,
  aliquotaIcms: 5,
  aliquotaPis: 0.65,
  aliquotaCofins: 3,
};

/**
 * Parâmetro fiscal ausente cai no padrão; presente é usado como está.
 * `null`, `undefined` e string vazia são ausência — zero NÃO é: alíquota zero
 * é uma decisão fiscal legítima e não pode virar 5% por engano.
 */
function parametro(valor, padrao) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return padrao;
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
}

/**
 * Impostos de uma venda de veículo usado. `config` é a linha de `fiscal_config`
 * (aceita a linha crua do Postgres, onde numeric chega como string).
 */
export function impostosVeiculoUsado(valorVenda, config = {}) {
  const reducaoBaseIcms = parametro(config.icms_reducao_base, PADRAO_IMPOSTOS.reducaoBaseIcms);
  const aliquotaIcms = parametro(config.icms_seminovo_aliquota, PADRAO_IMPOSTOS.aliquotaIcms);
  const aliquotaPis = parametro(config.pis_aliquota, PADRAO_IMPOSTOS.aliquotaPis);
  const aliquotaCofins = parametro(config.cofins_aliquota, PADRAO_IMPOSTOS.aliquotaCofins);

  const venda = Number(valorVenda) || 0;
  const zerado = {
    venda: 0,
    reducaoBaseIcms, aliquotaIcms, aliquotaPis, aliquotaCofins,
    baseIcms: 0, icms: 0, basePisCofins: 0, pis: 0, cofins: 0,
  };
  if (venda <= 0) return zerado;

  const baseIcms = round2((venda * (100 - reducaoBaseIcms)) / 100);
  const icms = round2((baseIcms * aliquotaIcms) / 100);
  const basePisCofins = round2(baseIcms - icms);
  const pis = round2((basePisCofins * aliquotaPis) / 100);
  const cofins = round2((basePisCofins * aliquotaCofins) / 100);

  return {
    venda,
    reducaoBaseIcms, aliquotaIcms, aliquotaPis, aliquotaCofins,
    baseIcms, icms, basePisCofins, pis, cofins,
  };
}
