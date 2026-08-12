/**
 * Os impostos da NF-e travados nos valores de uma nota REAL e autorizada.
 *
 * POR QUE ESTE ARQUIVO EXISTE: o cálculo anterior (base = venda − custo de
 * aquisição) parecia razoável, passava nos testes que existiam, e estava
 * errado — teria emitido o Porsche com ICMS 20% acima do devido e sem PIS nem
 * COFINS. Nenhum teste inventado pega isso: só a nota que a SEFAZ já carimbou.
 *
 * Fonte: DANFE da NF 12 da Vamaq, protocolo de autorização 131267805126821.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { impostosVeiculoUsado, PADRAO_IMPOSTOS } from "../src/lib/fiscal/impostos.js";

test("NF 12 autorizada: os quatro impostos batem ao centavo", () => {
  const i = impostosVeiculoUsado(157500);
  assert.equal(i.baseIcms, 7500.15, "base do ICMS na DANFE");
  assert.equal(i.icms, 375.01, "valor do ICMS na DANFE");
  assert.equal(i.pis, 46.31, "PIS na DANFE");
  assert.equal(i.cofins, 213.75, "COFINS na DANFE");
});

test("a base não é a margem — é aí que o cálculo antigo errava", () => {
  // Venda 157.500 e aquisição 150.000 dariam margem de exatamente 7.500,00.
  // A nota traz 7.500,15. Os 15 centavos são a assinatura do método correto.
  const i = impostosVeiculoUsado(157500);
  assert.notEqual(i.baseIcms, 7500.0);
  assert.equal(i.baseIcms, 7500.15);
});

test("o Porsche que falhou em produção: o cálculo antigo cobrava 20% a mais", () => {
  // Venda 175.000, aquisição 165.000 — a emissão que a Mayra tentou em
  // 11/08/2026 e que a SEFAZ recusou por falta de modalidade_frete. Se tivesse
  // passado, teria saído com estes números errados: base 10.000 e ICMS 500,00,
  // sem PIS nem COFINS. O erro de schema evitou uma nota com imposto errado.
  const i = impostosVeiculoUsado(175000);
  assert.equal(i.baseIcms, 8333.5);
  assert.equal(i.icms, 416.68);
  assert.equal(i.pis, 51.46);
  assert.equal(i.cofins, 237.5);

  const margem = 175000 - 165000;
  assert.equal(margem, 10000, "o que o cálculo antigo usava de base");
  assert.ok(i.baseIcms < margem, "a base correta é MENOR que a margem");
});

test("base do PIS/COFINS é a base do ICMS menos o ICMS", () => {
  const i = impostosVeiculoUsado(157500);
  assert.equal(i.basePisCofins, 7125.14);
  // Comparação em centavos: 7500.15 - 375.01 dá 7125.139999999999 em ponto
  // flutuante, e é justamente por isso que a função arredonda.
  assert.equal(Math.round(i.basePisCofins * 100), Math.round((i.baseIcms - i.icms) * 100));
});

test("venda sem valor não gera imposto", () => {
  for (const v of [0, -1, null, undefined, ""]) {
    const i = impostosVeiculoUsado(v);
    assert.equal(i.icms, 0, `venda ${JSON.stringify(v)}`);
    assert.equal(i.pis, 0);
    assert.equal(i.cofins, 0);
    assert.equal(i.baseIcms, 0);
  }
});

test("parâmetro ausente na config cai no padrão da nota autorizada", () => {
  const vazia = impostosVeiculoUsado(157500, {});
  const nulos = impostosVeiculoUsado(157500, {
    icms_reducao_base: null,
    icms_seminovo_aliquota: "",
    pis_aliquota: undefined,
    cofins_aliquota: "   ",
  });
  assert.deepEqual(nulos, vazia);
  assert.equal(vazia.reducaoBaseIcms, PADRAO_IMPOSTOS.reducaoBaseIcms);
});

test("numeric do Postgres chega como string e é aceito", () => {
  const comoTexto = impostosVeiculoUsado(157500, {
    icms_reducao_base: "95.238",
    icms_seminovo_aliquota: "5.00",
    pis_aliquota: "0.6500",
    cofins_aliquota: "3.0000",
  });
  assert.equal(comoTexto.icms, 375.01);
  assert.equal(comoTexto.cofins, 213.75);
});

test("alíquota zero é respeitada, não confundida com ausência", () => {
  // Zero é decisão fiscal (isenção); se virasse "ausente", o padrão de 5%
  // reapareceria e a nota sairia com imposto que o contador mandou zerar.
  const i = impostosVeiculoUsado(157500, { icms_seminovo_aliquota: 0, pis_aliquota: 0 });
  assert.equal(i.icms, 0);
  assert.equal(i.pis, 0);
  assert.equal(i.baseIcms, 7500.15, "a base continua existindo");
  assert.equal(i.cofins, 225.0, "COFINS segue no padrão: 7500,15 × 3%");
});

test("o contador consegue mudar a redução de base sem mexer em código", () => {
  const i = impostosVeiculoUsado(100000, { icms_reducao_base: 90 });
  assert.equal(i.baseIcms, 10000);
  assert.equal(i.icms, 500);
});
