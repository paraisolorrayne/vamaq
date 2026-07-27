/**
 * Testes das fórmulas do DRE/margem (ADR-001c §1). Puros — sem banco.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDRE, computeVehicleMargin } from "../src/lib/fin/calc.js";

const TXS = [
  { type: "revenue", amount: 200000, code: "3.1", status: "confirmed" }, // venda
  { type: "expense", amount: 150000, code: "4.1", status: "confirmed" }, // CMV (aquisição)
  { type: "expense", amount: 5000, code: "4.2", status: "confirmed" },   // CMV (preparação)
  { type: "expense", amount: 8000, code: "5.2.1", status: "confirmed" }, // despesa (marketing)
  { type: "expense", amount: 3000, code: "5.1.4", status: "confirmed" }, // despesa (aluguel)
  { type: "revenue", amount: 99999, code: "3.1", status: "pending" },    // pending: fora
];

test("DRE: receita, CMV (4.x) e despesas (5.x) separados", () => {
  const d = computeDRE(TXS);
  assert.equal(d.receita, 200000);
  assert.equal(d.custos, 155000);   // 150000 + 5000
  assert.equal(d.despesas, 11000);  // 8000 + 3000
  assert.equal(d.lucroBruto, 45000); // 200000 − 155000
  assert.equal(d.lucroLiquido, 34000); // 45000 − 11000
});

test("DRE: margens em %", () => {
  const d = computeDRE(TXS);
  assert.equal(d.margemBruta, 22.5);        // 45000/200000
  assert.equal(d.margemOperacional, 17);    // 34000/200000
});

test("DRE: pending não entra", () => {
  const d = computeDRE(TXS);
  assert.equal(d.receita, 200000); // ignora a receita pending de 99999
});

test("DRE: sem receita não divide por zero", () => {
  const d = computeDRE([{ type: "expense", amount: 100, code: "5.1.1", status: "confirmed" }]);
  assert.equal(d.margemBruta, 0);
  assert.equal(d.margemOperacional, 0);
  assert.equal(d.lucroLiquido, -100);
});

test("margem de um veículo: receita − custo", () => {
  const m = computeVehicleMargin([
    { type: "revenue", amount: 200000, status: "confirmed" },
    { type: "expense", amount: 150000, status: "confirmed" },
    { type: "expense", amount: 10000, status: "reconciled" },
  ]);
  assert.equal(m.receita, 200000);
  assert.equal(m.custo, 160000);
  assert.equal(m.resultado, 40000);
  assert.equal(m.margem, 20);
});
