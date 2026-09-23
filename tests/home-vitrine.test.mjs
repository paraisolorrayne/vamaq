/**
 * Quem aparece em cada seção da home (src/lib/home/vitrine.js).
 *
 * O DEFEITO (21/09/2026): a seção "Não é volume. É seleção." usava o carro
 * mais recente, e "Recém-chegados" usava os seis mais recentes DA MESMA LISTA
 * — o primeiro card dos recém-chegados era sempre o carro da seção de cima.
 * O herói já era tirado da lista; o da curadoria, não.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { escolherVitrine } from "../src/lib/home/vitrine.js";

const carro = (id, dia) => ({ id, created_at: `2026-09-${String(dia).padStart(2, "0")}T12:00:00Z` });
const ESTOQUE = [carro("a", 1), carro("b", 2), carro("c", 3), carro("d", 4), carro("e", 5),
  carro("f", 6), carro("g", 7), carro("h", 8), carro("i", 9)];

test("nenhum carro aparece em duas seções", () => {
  const v = escolherVitrine([ESTOQUE[0]], ESTOQUE);
  const ids = [v.hero.id, v.narrativa.id, ...v.recemChegados.map((c) => c.id)];
  assert.equal(new Set(ids).size, ids.length, `repetiu: ${ids.join(",")}`);
});

test("curadoria fica com o mais recente; recém-chegados, com os seis seguintes", () => {
  const v = escolherVitrine([ESTOQUE[0]], ESTOQUE);
  assert.equal(v.hero.id, "a");
  assert.equal(v.narrativa.id, "i");
  assert.deepEqual(v.recemChegados.map((c) => c.id), ["h", "g", "f", "e", "d", "c"]);
});

test("sem destaque marcado, o herói é o primeiro do estoque — e também não se repete", () => {
  const v = escolherVitrine([], ESTOQUE);
  assert.equal(v.hero.id, "a");
  assert.ok(!v.recemChegados.some((c) => c.id === "a"));
  assert.notEqual(v.narrativa.id, "a");
});

test("estoque de um carro só: a curadoria reaproveita o herói, recém-chegados some", () => {
  const v = escolherVitrine([], [ESTOQUE[0]]);
  assert.equal(v.hero.id, "a");
  assert.equal(v.narrativa.id, "a");
  assert.deepEqual(v.recemChegados, []);
});

test("estoque vazio não quebra", () => {
  assert.deepEqual(escolherVitrine([], []), { hero: null, narrativa: null, recemChegados: [] });
});
