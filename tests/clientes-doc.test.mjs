import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizaDoc, tipoPorDoc, formataDoc, docValido } from "../src/lib/clientes/doc.js";

test("normalizaDoc deixa só dígitos", () => {
  assert.equal(normalizaDoc("123.456.789-00"), "12345678900");
  assert.equal(normalizaDoc("12.345.678/0001-90"), "12345678000190");
  assert.equal(normalizaDoc("  123 456 "), "123456");
});

test("normalizaDoc aceita vazio, null e undefined sem quebrar", () => {
  assert.equal(normalizaDoc(""), "");
  assert.equal(normalizaDoc(null), "");
  assert.equal(normalizaDoc(undefined), "");
});

test("tipoPorDoc: 11 dígitos é pf, 14 é pj, o resto é null", () => {
  assert.equal(tipoPorDoc("12345678900"), "pf");
  assert.equal(tipoPorDoc("12345678000190"), "pj");
  assert.equal(tipoPorDoc("123"), null);
  assert.equal(tipoPorDoc(""), null);
});

test("tipoPorDoc normaliza antes de decidir", () => {
  assert.equal(tipoPorDoc("123.456.789-00"), "pf");
});

test("formataDoc aplica a máscara certa e devolve cru o que não é CPF nem CNPJ", () => {
  assert.equal(formataDoc("12345678900"), "123.456.789-00");
  assert.equal(formataDoc("12345678000190"), "12.345.678/0001-90");
  assert.equal(formataDoc("123"), "123");
  assert.equal(formataDoc(""), "");
});

test("docValido só aceita 11 ou 14 dígitos", () => {
  assert.equal(docValido("123.456.789-00"), true);
  assert.equal(docValido("12345678000190"), true);
  assert.equal(docValido("1234567890"), false);
  assert.equal(docValido(""), false);
});
