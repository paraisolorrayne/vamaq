/**
 * Filtro por período do estoque.
 *
 * O bug que estes testes existem para impedir: `new Date("2026-08-14")` é
 * meia-noite UTC, que em Uberlândia é dia 13 às 21h. Um carro que entrou no
 * dia 14 sumiria de um filtro "de 14 até 14" — e ninguém percebe, porque a
 * lista não fica vazia, só fica errada por um dia.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dentroDoPeriodo,
  filtraPorPeriodo,
  normalizaData,
  semData,
} from "../src/lib/estoque/periodo.js";

const FROTA = [
  { placa: "AAA1A11", data_entrada: "2026-08-01", data_saida: "2026-08-20" },
  { placa: "BBB2B22", data_entrada: "2026-08-14", data_saida: null },
  { placa: "CCC3C33", data_entrada: "2026-09-02", data_saida: null },
  { placa: "DDD4D44", data_entrada: null, data_saida: null }, // dos 43 antigos
];

test("data do dia exato entra no filtro daquele dia", () => {
  // O caso do fuso: de 14 até 14 tem que achar o carro que entrou no dia 14.
  const r = filtraPorPeriodo(FROTA, { de: "2026-08-14", ate: "2026-08-14" });
  assert.deepEqual(r.map((v) => v.placa), ["BBB2B22"]);
});

test("as duas pontas são inclusivas", () => {
  const r = filtraPorPeriodo(FROTA, { de: "2026-08-01", ate: "2026-08-14" });
  assert.deepEqual(r.map((v) => v.placa), ["AAA1A11", "BBB2B22"]);
});

test("só o início: dali em diante", () => {
  const r = filtraPorPeriodo(FROTA, { de: "2026-08-14" });
  assert.deepEqual(r.map((v) => v.placa), ["BBB2B22", "CCC3C33"]);
});

test("só o fim: até ali", () => {
  const r = filtraPorPeriodo(FROTA, { ate: "2026-08-13" });
  assert.deepEqual(r.map((v) => v.placa), ["AAA1A11"]);
});

test("filtro vazio devolve a lista inteira — nunca esconde carro", () => {
  for (const args of [{}, { de: "", ate: "" }, { de: null, ate: undefined }, undefined]) {
    assert.equal(filtraPorPeriodo(FROTA, args).length, FROTA.length, JSON.stringify(args));
  }
});

test("carro sem data fica de fora quando há período, e dentro quando não há", () => {
  const comPeriodo = filtraPorPeriodo(FROTA, { de: "2026-01-01", ate: "2026-12-31" });
  assert.ok(!comPeriodo.some((v) => v.placa === "DDD4D44"));
  assert.ok(filtraPorPeriodo(FROTA, {}).some((v) => v.placa === "DDD4D44"));
});

test("filtra por data de saída quando pedido", () => {
  const r = filtraPorPeriodo(FROTA, { de: "2026-08-01", ate: "2026-08-31", campo: "data_saida" });
  assert.deepEqual(r.map((v) => v.placa), ["AAA1A11"]);
});

test("não altera a lista recebida", () => {
  const copia = [...FROTA];
  filtraPorPeriodo(FROTA, { de: "2026-08-01" });
  assert.deepEqual(FROTA, copia);
});

test("conta quantos carros estão sem a data", () => {
  assert.equal(semData(FROTA, "data_entrada"), 1);
  assert.equal(semData(FROTA, "data_saida"), 3);
  assert.equal(semData([]), 0);
  assert.equal(semData(null), 0);
});

// --- normalizaData ---

test("aceita o Date que o Postgres devolve, sem andar um dia para trás", () => {
  // Coluna `date` -> o driver monta meia-noite UTC. Ler com getters locais
  // devolveria 13/08 a oeste de Greenwich.
  const doBanco = new Date("2026-08-14T00:00:00.000Z");
  assert.equal(normalizaData(doBanco), "2026-08-14");
});

test("corta o horário de um ISO completo em vez de converter", () => {
  assert.equal(normalizaData("2026-08-14T23:30:00.000Z"), "2026-08-14");
  assert.equal(normalizaData("2026-08-14 10:00:00"), "2026-08-14");
});

test("recusa o que não é data em vez de inventar uma", () => {
  for (const ruim of ["", "   ", "14/08/2026", "ontem", "2026-8-4", null, undefined, new Date("x")]) {
    assert.equal(normalizaData(ruim), null, JSON.stringify(String(ruim)));
  }
});

test("dentroDoPeriodo recusa data ausente", () => {
  assert.equal(dentroDoPeriodo(null, "2026-01-01", "2026-12-31"), false);
  assert.equal(dentroDoPeriodo("", null, null), false);
});

test("período invertido não devolve nada, em vez de devolver tudo", () => {
  // De 31/08 até 01/08 é engano de digitação. Devolver a lista inteira faria
  // parecer que o filtro não pegou; devolver vazio mostra que pegou.
  assert.deepEqual(filtraPorPeriodo(FROTA, { de: "2026-08-31", ate: "2026-08-01" }), []);
});
