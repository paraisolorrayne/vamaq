/**
 * Os impostos da NF-e travados nos valores de uma nota REAL e autorizada.
 *
 * Fonte: DANFE da NF 12 da Vamaq, protocolo 131267805126821 — venda
 * 157.500,00, aquisição 150.000,00.
 *
 * POR QUE ESTE ARQUIVO EXISTE, E O QUE ELE NÃO CONSEGUE PROVAR: uma nota só
 * não distingue "base = margem" de "base = percentual fixo sobre a venda",
 * porque naquele carro a margem calhou de ser 1/21 da venda (foi vendido por
 * exatamente aquisição × 1,05) — e 1/21 é 4,762%, o complemento de 95,238%.
 * Eu já implementei a leitura errada por causa disso. Os testes de margem
 * diferente abaixo é que separam as duas hipóteses; enquanto não houver uma
 * segunda nota autorizada com outra margem, eles valem como decisão de
 * projeto, não como fato confirmado pela SEFAZ.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { impostosVeiculoUsado, PADRAO_IMPOSTOS } from "../src/lib/fiscal/impostos.js";

const NF12 = [157500, 150000];

test("NF 12 autorizada: os quatro impostos batem ao centavo", () => {
  const i = impostosVeiculoUsado(...NF12);
  assert.equal(i.baseIcms, 7500.15, "base do ICMS na DANFE");
  assert.equal(i.icms, 375.01, "valor do ICMS na DANFE");
  assert.equal(i.pis, 46.31, "PIS na DANFE");
  assert.equal(i.cofins, 213.75, "COFINS na DANFE");
});

test("a redução vai na nota como 95,238 — o número que aparece no XML da NF 12", () => {
  assert.equal(impostosVeiculoUsado(...NF12).reducaoBaseIcms, 95.238);
});

test("os 15 centavos são o arredondamento do pRedBC, não outra base", () => {
  // A margem crua é 7.500,00. A base sai 7.500,15 porque o percentual de
  // redução é arredondado a 3 casas e a base deriva dele. Se algum dia a base
  // voltar a ser a margem crua, este teste avisa.
  const i = impostosVeiculoUsado(...NF12);
  assert.equal(i.margem, 7500);
  assert.equal(i.baseIcms, 7500.15);
});

test("margem diferente muda a base — é isto que separa margem de redução fixa", () => {
  // O Porsche que a Mayra tentou emitir: venda 175.000, aquisição 165.000.
  // Pela margem: base ~10.000. Por uma redução fixa de 95,238%: base 8.333,50.
  const i = impostosVeiculoUsado(175000, 165000);
  assert.equal(i.margem, 10000);
  assert.equal(i.baseIcms, 9999.5);
  assert.equal(i.icms, 499.98);
  assert.notEqual(i.baseIcms, 8333.5, "8.333,50 é a leitura de redução fixa, que descartamos");
});

test("margem grande gera imposto grande — o inverso também vale", () => {
  const i = impostosVeiculoUsado(200000, 150000);
  assert.equal(i.margem, 50000);
  assert.equal(i.baseIcms, 50000);
  assert.equal(i.icms, 2500);
});

test("venda no prejuízo não gera imposto", () => {
  const i = impostosVeiculoUsado(140000, 150000);
  assert.equal(i.margem, 0);
  assert.equal(i.baseIcms, 0);
  assert.equal(i.icms, 0);
  assert.equal(i.pis, 0);
  assert.equal(i.cofins, 0);
});

test("sem custo de aquisição o imposto incide sobre a venda inteira", () => {
  // Não é um caso a tolerar: é o motivo de o valor de aquisição ser
  // obrigatório na tela de emissão.
  const i = impostosVeiculoUsado(100000, 0);
  assert.equal(i.reducaoBaseIcms, 0);
  assert.equal(i.baseIcms, 100000);
  assert.equal(i.icms, 5000);
});

test("base do PIS/COFINS é a base do ICMS menos o ICMS", () => {
  const i = impostosVeiculoUsado(...NF12);
  assert.equal(i.basePisCofins, 7125.14);
  assert.equal(Math.round(i.basePisCofins * 100), Math.round((i.baseIcms - i.icms) * 100));
});

test("venda sem valor não gera imposto", () => {
  for (const v of [0, -1, null, undefined, ""]) {
    const i = impostosVeiculoUsado(v, 50000);
    assert.equal(i.icms, 0, `venda ${JSON.stringify(v)}`);
    assert.equal(i.baseIcms, 0);
    assert.equal(i.margem, 0);
  }
});

test("numeric do Postgres chega como string e é aceito", () => {
  const i = impostosVeiculoUsado("157500.00", "150000.00", {
    icms_seminovo_aliquota: "5.00",
    pis_aliquota: "0.6500",
    cofins_aliquota: "3.0000",
  });
  assert.equal(i.icms, 375.01);
  assert.equal(i.cofins, 213.75);
});

test("alíquota zero é respeitada, não confundida com ausência", () => {
  const i = impostosVeiculoUsado(...NF12, { icms_seminovo_aliquota: 0, pis_aliquota: 0 });
  assert.equal(i.icms, 0);
  assert.equal(i.pis, 0);
  assert.equal(i.baseIcms, 7500.15, "a base continua existindo");
  assert.equal(i.cofins, 225.0, "COFINS segue no padrão: 7.500,15 × 3%");
});

// Se o contador responder que a redução é fixa, isso vira configuração — sem
// tocar em código e sem outra rodada de deploy.
test("método 'reducao_fixa' ignora a margem e usa o percentual cadastrado", () => {
  const i = impostosVeiculoUsado(175000, 165000, {
    icms_base_metodo: "reducao_fixa",
    icms_reducao_base: 95.238,
  });
  assert.equal(i.baseIcms, 8333.5);
  assert.equal(i.icms, 416.68);
});

test("sem método cadastrado, o padrão é a margem", () => {
  assert.equal(impostosVeiculoUsado(...NF12, {}).metodo, "margem");
  assert.equal(impostosVeiculoUsado(...NF12, { icms_base_metodo: "" }).metodo, "margem");
  assert.equal(PADRAO_IMPOSTOS.reducaoBaseIcms, 95.238, "só usado no método fixo");
});
