import { test } from "node:test";
import assert from "node:assert/strict";
import { veiculoComPlaca } from "../src/lib/crm/veiculoComPlaca.js";

const VEICULO = { vehicle_brand: "Toyota", vehicle_model: "Corolla", vehicle_year: 2021 };

test("com placa: rótulo do veículo seguido da placa", () => {
  const o = { ...VEICULO, vehicle_placa: "ABC1D23" };
  assert.equal(veiculoComPlaca(o), "Toyota Corolla 2021 — placa ABC1D23");
});

test("sem placa: só o rótulo do veículo, sem a emenda", () => {
  const o = { ...VEICULO, vehicle_placa: null };
  assert.equal(veiculoComPlaca(o), "Toyota Corolla 2021");
});

test("placa vazia (string): tratada como ausente, sem a emenda", () => {
  const o = { ...VEICULO, vehicle_placa: "" };
  assert.equal(veiculoComPlaca(o), "Toyota Corolla 2021");
});

test("sem veículo vinculado: string vazia mesmo com placa (não deveria acontecer, mas não quebra)", () => {
  assert.equal(veiculoComPlaca({ vehicle_placa: "ABC1D23" }), "");
  assert.equal(veiculoComPlaca({}), "");
  assert.equal(veiculoComPlaca(null), "");
  assert.equal(veiculoComPlaca(undefined), "");
});
