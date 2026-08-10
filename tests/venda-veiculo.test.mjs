/**
 * podeMarcarVendido (src/lib/vendaVeiculo.js) — pura, sem banco. Fonte única
 * da regra usada tanto pelo botão "Marcar vendido" da lista de Estoque
 * quanto pela tela /admin/estoque/[id]/vender (defesa em profundidade,
 * mesmo padrão de acoesDaEtapa no CRM — ver src/app/admin/crm/[id]/vender/page.js).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { podeMarcarVendido } from "../src/lib/vendaVeiculo.js";

test("disponível pode ser marcado como vendido", () => {
  assert.equal(podeMarcarVendido({ status: "disponivel" }), true);
});

test("reservado pode ser marcado como vendido", () => {
  assert.equal(podeMarcarVendido({ status: "reservado" }), true);
});

test("vendido não pode ser marcado como vendido de novo", () => {
  assert.equal(podeMarcarVendido({ status: "vendido" }), false);
});

test("inativo não pode ser marcado como vendido", () => {
  assert.equal(podeMarcarVendido({ status: "inativo" }), false);
});

test("veículo nulo não pode ser marcado como vendido", () => {
  assert.equal(podeMarcarVendido(null), false);
});

test("objeto vazio (sem status) pode — trata como disponível", () => {
  assert.equal(podeMarcarVendido({}), true);
});
