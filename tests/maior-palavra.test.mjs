import { test } from "node:test";
import assert from "node:assert/strict";
import { letrasDaMaiorPalavra } from "../src/lib/maiorPalavra.js";

test("conta a palavra mais longa, não o nome inteiro", () => {
  assert.equal(letrasDaMaiorPalavra("X6 M Competition"), 11);
  assert.equal(letrasDaMaiorPalavra("911 Carrera S"), 7);
});

test("espaços repetidos e nas pontas não contam", () => {
  assert.equal(letrasDaMaiorPalavra("  Range   Rover  "), 5);
});

test("vazio ou ausente devolve 1, nunca zero (vai para um divisor no CSS)", () => {
  assert.equal(letrasDaMaiorPalavra(""), 1);
  assert.equal(letrasDaMaiorPalavra(null), 1);
  assert.equal(letrasDaMaiorPalavra(undefined), 1);
});
