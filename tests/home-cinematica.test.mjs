/**
 * O que entra em cada cena da home cinematográfica
 * (src/lib/home/cinematica.js).
 *
 * As garantias que importam para o briefing: nenhum carro em duas cenas e
 * nenhum carro sem foto em cena feita de foto.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { escolherCenas, formatarPreco } from "../src/lib/home/cinematica.js";

const fotos = (n, id) => ({
  main: `/images/vehicles/${id}-1.webp`,
  gallery: Array.from({ length: n }, (_, i) => `/images/vehicles/${id}-${i + 1}.webp`),
});
const carro = (id, dia, n = 3, extra = {}) => ({
  id,
  created_at: `2026-10-${String(dia).padStart(2, "0")}T12:00:00Z`,
  images: fotos(n, id),
  ...extra,
});

test("herói não se repete na vitrine; outros destaques vêm antes dos recentes", () => {
  const estoque = [carro("a", 1), carro("b", 2), carro("c", 3), carro("d", 4)];
  const { hero, vitrine } = escolherCenas([estoque[0], estoque[1]], estoque);
  assert.equal(hero.id, "a");
  assert.deepEqual(vitrine.map((v) => v.id), ["b", "d", "c"]);
});

test("vitrine para em cinco carros", () => {
  const estoque = Array.from({ length: 9 }, (_, i) => carro(`c${i}`, i + 1));
  assert.equal(escolherCenas([], estoque).vitrine.length, 5);
});

test("carro sem foto não vira herói nem entra na vitrine", () => {
  const semFoto = { id: "x", created_at: "2026-10-20T12:00:00Z", images: { main: "", gallery: [] } };
  const estoque = [semFoto, carro("a", 1)];
  const { hero, vitrine } = escolherCenas([semFoto], estoque);
  assert.equal(hero.id, "a");
  assert.ok(!vitrine.some((v) => v.id === "x"));
});

test("preço vazio vira Sob consulta", () => {
  assert.equal(formatarPreco({ price: null }), "Sob consulta");
  assert.match(formatarPreco({ price: 659000 }), /R\$\s659\.000$/);
});
