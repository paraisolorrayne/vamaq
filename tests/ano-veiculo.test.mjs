import { test } from "node:test";
import assert from "node:assert/strict";
import { anoVeiculo } from "../src/lib/anoVeiculo.js";

test("sem ano de modelo, mostra só o de fabricação", () => {
  assert.equal(anoVeiculo({ year: 2021 }), "2021");
  assert.equal(anoVeiculo({ year: 2021, ano_modelo: null }), "2021");
});

test("com ano de modelo diferente, mostra os dois", () => {
  assert.equal(anoVeiculo({ year: 2021, ano_modelo: 2022 }), "2021/2022");
});

test("ano de modelo igual ao de fabricação não repete", () => {
  assert.equal(anoVeiculo({ year: 2022, ano_modelo: 2022 }), "2022");
});

test("aceita string vinda do formulário", () => {
  assert.equal(anoVeiculo({ year: "2021", ano_modelo: "2022" }), "2021/2022");
  assert.equal(anoVeiculo({ year: "2022", ano_modelo: "2022" }), "2022");
});

test("sem ano de fabricação devolve string vazia", () => {
  assert.equal(anoVeiculo({}), "");
  assert.equal(anoVeiculo(null), "");
  assert.equal(anoVeiculo({ ano_modelo: 2022 }), "");
});

test("ano de modelo vazio ou zero é tratado como ausente", () => {
  assert.equal(anoVeiculo({ year: 2021, ano_modelo: "" }), "2021");
  assert.equal(anoVeiculo({ year: 2021, ano_modelo: 0 }), "2021");
});
