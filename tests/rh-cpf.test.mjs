/**
 * Validação de CPF (ficha do funcionário). Puro — sem banco.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCpf, isValidCpf } from "../src/lib/rh/cpf.js";

test("normalizeCpf tira pontuação e espaços", () => {
  assert.equal(normalizeCpf(" 529.982.247-25 "), "52998224725");
  assert.equal(normalizeCpf(null), "");
  assert.equal(normalizeCpf(undefined), "");
});

test("isValidCpf aceita CPF válido, com ou sem máscara", () => {
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("52998224725"), true);
});

test("isValidCpf rejeita dígito verificador errado", () => {
  assert.equal(isValidCpf("529.982.247-24"), false);
});

test("isValidCpf rejeita sequências repetidas e tamanho errado", () => {
  assert.equal(isValidCpf("111.111.111-11"), false);
  assert.equal(isValidCpf("00000000000"), false);
  assert.equal(isValidCpf("1234567890"), false);
  assert.equal(isValidCpf(""), false);
});
