import { test } from "node:test";
import assert from "node:assert/strict";
import { rotuloVeiculo } from "../src/lib/crm/rotuloVeiculo.js";

test("veículo completo, com ano de modelo diferente da fabricação", () => {
  const o = { vehicle_brand: "Toyota", vehicle_model: "Corolla", vehicle_year: 2021, vehicle_ano_modelo: 2022 };
  assert.equal(rotuloVeiculo(o), "Toyota Corolla 2021/2022");
});

test("sem ano de modelo: mostra só o ano de fabricação", () => {
  const o = { vehicle_brand: "Toyota", vehicle_model: "Corolla", vehicle_year: 2021 };
  assert.equal(rotuloVeiculo(o), "Toyota Corolla 2021");
});

test("só marca: modelo e ano ausentes não viram espaço sobrando", () => {
  const o = { vehicle_brand: "Toyota" };
  assert.equal(rotuloVeiculo(o), "Toyota");
});

test("nenhum dado de veículo devolve string vazia", () => {
  assert.equal(rotuloVeiculo({}), "");
  assert.equal(rotuloVeiculo(null), "");
  assert.equal(rotuloVeiculo(undefined), "");
});
