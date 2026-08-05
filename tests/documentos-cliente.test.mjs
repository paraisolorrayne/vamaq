/**
 * De quem é o documento — a outra parte, por modelo de contrato.
 * Puro: sem banco, sem rede.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { clienteDoDocumento } from "../src/lib/documentosCliente.js";

test("compra e venda: a outra parte é o vendedor", () => {
  assert.equal(
    clienteDoDocumento("compra-venda", { vendedor_nome: "João Silva", comprador_nome: "Vamaq" }),
    "João Silva"
  );
});

test("venda: a outra parte é o comprador", () => {
  assert.equal(clienteDoDocumento("venda", { comprador_nome: "Maria Souza" }), "Maria Souza");
});

test("consignação e vistoria: a outra parte é o proprietário", () => {
  assert.equal(clienteDoDocumento("consignacao", { proprietario_nome: "Carlos Lima" }), "Carlos Lima");
  assert.equal(clienteDoDocumento("termo-vistoria", { proprietario_nome: "Ana Costa" }), "Ana Costa");
});

test("devolve null quando o campo está vazio ou só com espaços", () => {
  assert.equal(clienteDoDocumento("venda", { comprador_nome: "" }), null);
  assert.equal(clienteDoDocumento("venda", { comprador_nome: "   " }), null);
  assert.equal(clienteDoDocumento("venda", {}), null);
});

test("devolve null para modelo desconhecido ou valores ausentes", () => {
  assert.equal(clienteDoDocumento("modelo-que-nao-existe", { vendedor_nome: "X" }), null);
  assert.equal(clienteDoDocumento("venda", null), null);
  assert.equal(clienteDoDocumento(null, {}), null);
});

test("apara espaços em volta do nome", () => {
  assert.equal(clienteDoDocumento("venda", { comprador_nome: "  Maria Souza  " }), "Maria Souza");
});
