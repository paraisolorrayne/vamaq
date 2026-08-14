/**
 * Impostos da NF-e de veículo usado (Vamaq — Lucro Presumido, MG).
 *
 * FONTE: a NF 12 da própria Vamaq, autorizada pela SEFAZ-MG sob o protocolo
 * 131267805126821. Venda 157.500,00, aquisição 150.000,00; a DANFE traz base
 * de ICMS 7.500,15, ICMS 375,01, PIS 46,31 e COFINS 213,75. As quatro linhas
 * fecham ao centavo pela cadeia abaixo, e tests/fiscal-impostos.test.mjs prende
 * exatamente esses valores.
 *
 *   margem         = venda − aquisição            (nunca negativa)
 *   redução (pRedBC) = (1 − margem/venda) × 100, ARREDONDADA a 3 casas
 *   base do ICMS   = venda × (100 − redução)      ← deriva do pRedBC arredondado
 *   ICMS           = base do ICMS × alíquota      alíquota = 5%
 *   base PIS/COFINS= base do ICMS − ICMS
 *   PIS / COFINS   = essa base × 0,65% / 3%       (cumulativo)
 *
 * POR QUE A BASE É A MARGEM, MAS PASSA POR UM PERCENTUAL: o XML da NF-e não
 * aceita uma base menor que o valor do item sem justificar — daí o pRedBC. O
 * emissor calcula o percentual a partir da margem, arredonda (o campo tem 3-4
 * casas) e a base sai desse arredondamento. É isso que explica os 15 centavos
 * da NF 12: pela margem crua daria 7.500,00, e a nota traz 7.500,15.
 *
 * ARMADILHA QUE JÁ ME PEGOU (12/08/2026): li os 15 centavos como prova de que a
 * base ignorava a margem e era um percentual fixo de 95,238%. Não era. Naquela
 * nota o carro foi vendido por exatamente `aquisição × 1,05`, então a margem
 * valia 1/21 da venda — que é justamente 4,762%. As duas leituras reproduziam a
 * mesma nota. O que desempata: 95,238% não é número de lei (redução legal é
 * redonda), é número calculado. Uma nota só não distingue as hipóteses —
 * confirmar sempre com uma segunda nota de margem diferente.
 *
 * Se o contador disser que a redução é fixa, é configuração, não código:
 * `fiscal_config.icms_base_metodo = 'reducao_fixa'` passa a usar
 * `icms_reducao_base`.
 *
 * Puro de propósito: sem banco e sem rede, para rodar em `node --test`.
 */
import { round2 } from "../fin/calc.js";

/** Alíquotas da NF 12 autorizada. Servem de default quando fiscal_config é omissa. */
export const PADRAO_IMPOSTOS = {
  aliquotaIcms: 5,
  aliquotaPis: 0.65,
  aliquotaCofins: 3,
  /** Só usado quando o método é 'reducao_fixa'. */
  reducaoBaseIcms: 95.238,
  // Reforma tributária — valores passados pelo contador em 14/08/2026, válidos
  // desde 03/08/2026. São alíquotas de transição, muito baixas de propósito.
  aliquotaIbsUf: 0.1,
  aliquotaIbsMun: 0,
  aliquotaCbs: 0.9,
};

/** pRedBC tem 3 a 4 casas no layout da NF-e; o emissor da Vamaq usa 3. */
function round3(n) {
  return Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
}

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
export function impostosVeiculoUsado(valorVenda, custoAquisicao, config = {}) {
  const aliquotaIcms = parametro(config.icms_seminovo_aliquota, PADRAO_IMPOSTOS.aliquotaIcms);
  const aliquotaPis = parametro(config.pis_aliquota, PADRAO_IMPOSTOS.aliquotaPis);
  const aliquotaCofins = parametro(config.cofins_aliquota, PADRAO_IMPOSTOS.aliquotaCofins);
  const metodo = String(config.icms_base_metodo || "margem").trim();

  const venda = Number(valorVenda) || 0;
  const custo = Number(custoAquisicao) || 0;
  const margem = venda > 0 ? Math.max(0, round2(venda - custo)) : 0;

  if (venda <= 0) {
    return {
      venda: 0, margem: 0, metodo,
      reducaoBaseIcms: 0, aliquotaIcms, aliquotaPis, aliquotaCofins,
      baseIcms: 0, icms: 0, basePisCofins: 0, pis: 0, cofins: 0,
      baseIbsCbs: 0, ibsUf: 0, ibsMun: 0, cbs: 0,
      aliquotaIbsUf: parametro(config.ibs_uf_aliquota, PADRAO_IMPOSTOS.aliquotaIbsUf),
      aliquotaIbsMun: parametro(config.ibs_mun_aliquota, PADRAO_IMPOSTOS.aliquotaIbsMun),
      aliquotaCbs: parametro(config.cbs_aliquota, PADRAO_IMPOSTOS.aliquotaCbs),
    };
  }

  const reducaoBaseIcms =
    metodo === "reducao_fixa"
      ? parametro(config.icms_reducao_base, PADRAO_IMPOSTOS.reducaoBaseIcms)
      : round3((1 - margem / venda) * 100);

  const baseIcms = round2((venda * (100 - reducaoBaseIcms)) / 100);
  const icms = round2((baseIcms * aliquotaIcms) / 100);
  const basePisCofins = round2(baseIcms - icms);
  const pis = round2((basePisCofins * aliquotaPis) / 100);
  const cofins = round2((basePisCofins * aliquotaCofins) / 100);

  // IBS/CBS (reforma tributária). A base é o VALOR TOTAL DA NOTA, não a margem
  // — contador, 14/08/2026, respondendo à pergunta direta. Eu tinha assumido a
  // margem por analogia com o ICMS e estava errado: numa venda de 175.000 com
  // margem de 10.000, a CBS é R$ 1.575 e não R$ 90. Não é diferença de
  // arredondamento, é uma ordem de grandeza.
  //
  // O IBS vai inteiro na competência ESTADUAL na nota de venda (mesma resposta);
  // por isso a alíquota municipal nasce zerada em fiscal_config.
  const aliquotaIbsUf = parametro(config.ibs_uf_aliquota, PADRAO_IMPOSTOS.aliquotaIbsUf);
  const aliquotaIbsMun = parametro(config.ibs_mun_aliquota, PADRAO_IMPOSTOS.aliquotaIbsMun);
  const aliquotaCbs = parametro(config.cbs_aliquota, PADRAO_IMPOSTOS.aliquotaCbs);
  const baseIbsCbs = venda;
  const ibsUf = round2((baseIbsCbs * aliquotaIbsUf) / 100);
  const ibsMun = round2((baseIbsCbs * aliquotaIbsMun) / 100);
  const cbs = round2((baseIbsCbs * aliquotaCbs) / 100);

  return {
    venda, margem, metodo,
    reducaoBaseIcms, aliquotaIcms, aliquotaPis, aliquotaCofins,
    baseIcms, icms, basePisCofins, pis, cofins,
    baseIbsCbs, aliquotaIbsUf, aliquotaIbsMun, aliquotaCbs, ibsUf, ibsMun, cbs,
  };
}
