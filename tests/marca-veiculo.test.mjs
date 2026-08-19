/**
 * Grafia única da marca do veículo.
 *
 * O QUE ORIGINOU (19/08/2026): uma captura do acervo para a prestação de contas
 * mostrou `AUDI`, `Audi` e `Audi ` como três marcas na lista de filtros, e
 * `BMW` duas vezes — 17 entradas para 13 marcas reais. O cadastro gravava
 * `body.brand` cru, então cada pessoa que digitava criava uma variante.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizaMarca, marcasConhecidas } from "../src/lib/marcaVeiculo.js";

test("apara espaço das pontas — a causa de `Audi` e `Audi ` coexistirem", () => {
  assert.equal(normalizaMarca("Audi "), "Audi");
  assert.equal(normalizaMarca("  Fiat  "), "Fiat");
  assert.equal(normalizaMarca("Volkswagen "), "Volkswagen");
});

test("uniformiza a caixa pela grafia da montadora", () => {
  assert.equal(normalizaMarca("AUDI"), "Audi");
  assert.equal(normalizaMarca("audi"), "Audi");
  assert.equal(normalizaMarca("bmw"), "BMW");
  assert.equal(normalizaMarca("BMW "), "BMW");
  assert.equal(normalizaMarca("LAND ROVER"), "Land Rover");
  assert.equal(normalizaMarca("land rover"), "Land Rover");
});

test("não é caixa alta nem capitalização cega — marca tem grafia própria", () => {
  // Caixa alta daria MERCEDES-BENZ; capitalizar daria Bmw. As duas erradas.
  assert.equal(normalizaMarca("mercedes benz"), "Mercedes-Benz");
  assert.equal(normalizaMarca("MERCEDES-BENZ"), "Mercedes-Benz");
  assert.equal(normalizaMarca("bmw"), "BMW");
  assert.equal(normalizaMarca("ram"), "RAM");
});

test("hífen e espaço são a mesma coisa na comparação", () => {
  assert.equal(normalizaMarca("Land-Rover"), "Land Rover");
  assert.equal(normalizaMarca("mercedesbenz"), "Mercedes-Benz");
});

test("marca desconhecida é aceita como foi digitada, só aparada", () => {
  // O pátio recebe carro de marca que ninguém previu. Recusar ou deturpar o
  // que a pessoa escreveu seria pior que uma variante a mais.
  assert.equal(normalizaMarca("  Lamborghini "), "Lamborghini");
  assert.equal(normalizaMarca("Aston Martin"), "Aston Martin");
});

test("espaço repetido no meio some", () => {
  assert.equal(normalizaMarca("Land    Rover"), "Land Rover");
});

test("vazio, nulo e indefinido viram string vazia, não quebram", () => {
  for (const v of ["", "   ", null, undefined]) {
    assert.equal(normalizaMarca(v), "");
  }
});

test("normalizar duas vezes dá o mesmo resultado", () => {
  // Idempotência: a migration roda sobre dados que o cadastro já normalizou.
  for (const v of ["AUDI", "bmw ", "Land-Rover", "Lamborghini", ""]) {
    assert.equal(normalizaMarca(normalizaMarca(v)), normalizaMarca(v));
  }
});

test("as marcas do estoque de hoje colapsam para 13", () => {
  // As 17 variantes que estavam em produção em 19/08/2026.
  const emProducao = [
    "AUDI", "Audi", "Audi ", "BMW", "BMW ", "CHEVROLET", "Fiat ", "FORD",
    "JAGUAR", "Jeep", "LAND ROVER", "Land Rover", "Mercedes-Benz", "PORSCHE",
    "RAM", "TOYOTA", "Volkswagen ",
  ];
  const distintas = new Set(emProducao.map(normalizaMarca));
  assert.equal(emProducao.length, 17, "eram 17 variantes gravadas");
  assert.equal(distintas.size, 13, "têm que colapsar para 13 marcas reais");
});

test("a lista canônica não tem duplicata escondida", () => {
  const chaves = marcasConhecidas().map((m) => normalizaMarca(m));
  assert.equal(new Set(chaves).size, chaves.length);
});
