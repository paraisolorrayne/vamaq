/**
 * Testes puros de src/lib/clientes/busca.js — sem banco (a prova contra
 * Postgres de verdade, incluindo o caso "Carlos Mendes" acha "Carlos
 * Mendez", está em tests/clientes-busca-aproximada.test.mjs).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeCuringasLike, clausulaBuscaNome, aplicarLimite } from "../src/lib/clientes/busca.js";

test("escapeCuringasLike escapa %, _ e \\", () => {
  assert.equal(escapeCuringasLike("50%_off\\"), "50\\%\\_off\\\\");
});

test("clausulaBuscaNome: termo vazio devolve null", () => {
  assert.equal(clausulaBuscaNome("", 1), null);
  assert.equal(clausulaBuscaNome("   ", 1), null);
});

test("clausulaBuscaNome: token com menos de 3 caracteres não entra na cláusula", () => {
  const r = clausulaBuscaNome("Jo", 1);
  assert.equal(r.clause, "lower(c.nome) like $1");
  assert.deepEqual(r.params, ["%jo%"]);
  assert.equal(r.nextIndex, 2);
});

test("clausulaBuscaNome: primeiro token com 3+ caracteres entra como OR", () => {
  const r = clausulaBuscaNome("Carlos Mendes", 1);
  assert.equal(r.clause, "lower(c.nome) like $1 or lower(c.nome) like $2");
  assert.deepEqual(r.params, ["%carlos mendes%", "%carlos%"]);
  assert.equal(r.nextIndex, 3);
});

test("clausulaBuscaNome: respeita o índice inicial dos parâmetros", () => {
  const r = clausulaBuscaNome("Carlos Mendes", 5);
  assert.equal(r.clause, "lower(c.nome) like $5 or lower(c.nome) like $6");
  assert.equal(r.orderBy, "case when lower(c.nome) like $5 then 0 else 1 end");
  assert.equal(r.nextIndex, 7);
});

test("clausulaBuscaNome: escapa curingas do termo e do token", () => {
  const r = clausulaBuscaNome("50%_off teste", 1);
  assert.deepEqual(r.params, ["%50\\%\\_off teste%", "%50\\%\\_off%"]);
});

test("aplicarLimite: sem limite, devolve a lista como veio", () => {
  const rows = [{ id: 1 }, { id: 2 }];
  const r = aplicarLimite(rows, undefined);
  assert.equal(r, rows);
  assert.equal(r.mais, undefined);
});

test("aplicarLimite: menos itens que o limite, não corta e mais é false", () => {
  const rows = [{ id: 1 }, { id: 2 }];
  const r = aplicarLimite(rows, 8);
  assert.equal(r.length, 2);
  assert.equal(r.mais, false);
});

test("aplicarLimite: mais itens que o limite, corta e marca mais=true", () => {
  const rows = Array.from({ length: 9 }, (_, i) => ({ id: i }));
  const r = aplicarLimite(rows, 8);
  assert.equal(r.length, 8);
  assert.equal(r.mais, true);
  assert.deepEqual(r.map((c) => c.id), [0, 1, 2, 3, 4, 5, 6, 7]);
});
