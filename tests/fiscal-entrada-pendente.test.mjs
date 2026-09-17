/**
 * Quais carros ainda precisam de nota de ENTRADA — por veículo E ciclo.
 *
 * POR QUE ESTE TESTE EXISTE: a tela de Notas Fiscais montava essa lista
 * comparando só `vehicle_id`. O carro que voltou na troca carrega a entrada
 * autorizada do ciclo 1 para sempre, então ele sumia do seletor "Emitir nota
 * de entrada" — e, quando era o único candidato, a tela ainda afirmava que
 * "todos os veículos do estoque já têm nota de entrada". Sem esse seletor não
 * existe outro caminho para /admin/fiscal/entrada/[id]: a metade fiscal do
 * retorno ao estoque ficava inalcançável pela operadora.
 *
 * É a terceira vez que a mesma pergunta aparece copiada (guarda do emissor,
 * guarda da tela de entrada, e esta). As duas primeiras viraram
 * `notaEntradaAtiva`; esta vira função pura porque a tela é JSX e o Node puro
 * não importa JSX — foi exatamente por isso que as guardas de tela passaram
 * tanto tempo sem teste.
 *
 *   npm test   (função pura, sem banco)
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { veiculosSemEntrada } from "../src/lib/fiscal/entradaPendente.js";

const CARRO_NOVO = { id: "v-novo", ciclo: 1, placa: "AAA1A11" };
const CARRO_COM_ENTRADA = { id: "v-entrada", ciclo: 1, placa: "BBB2B22" };
const CARRO_QUE_VOLTOU = { id: "v-troca", ciclo: 2, placa: "CCC3C33" };

function nota(vehicle_id, ciclo, extra = {}) {
  return { vehicle_id, ciclo, operacao: "entrada", status: "autorizada", ...extra };
}

test("carro sem nota nenhuma precisa de entrada", () => {
  const r = veiculosSemEntrada([CARRO_NOVO], []);
  assert.deepEqual(r.map((v) => v.id), ["v-novo"]);
});

test("carro com entrada viva no ciclo corrente NÃO aparece", () => {
  const r = veiculosSemEntrada([CARRO_COM_ENTRADA], [nota("v-entrada", 1)]);
  assert.deepEqual(r, []);
});

test("carro que voltou na troca precisa de entrada NOVA, apesar da do ciclo 1", () => {
  // O caso que o recurso inteiro existe para destravar: a entrada do ciclo 1
  // continua autorizada no banco, e não pode esconder o carro do seletor.
  const r = veiculosSemEntrada([CARRO_QUE_VOLTOU], [nota("v-troca", 1)]);
  assert.deepEqual(r.map((v) => v.id), ["v-troca"]);
});

test("a entrada do ciclo 2 tira o carro da lista de novo", () => {
  const r = veiculosSemEntrada(
    [CARRO_QUE_VOLTOU],
    [nota("v-troca", 1), nota("v-troca", 2)]
  );
  assert.deepEqual(r, []);
});

test("entrada cancelada ou com erro não conta como entrada viva", () => {
  const r = veiculosSemEntrada(
    [CARRO_COM_ENTRADA],
    [nota("v-entrada", 1, { status: "cancelada" }), nota("v-entrada", 1, { status: "erro" })]
  );
  assert.deepEqual(r.map((v) => v.id), ["v-entrada"]);
});

test("nota em processamento já segura o carro — não emitir duas vezes", () => {
  const r = veiculosSemEntrada([CARRO_COM_ENTRADA], [nota("v-entrada", 1, { status: "processando" })]);
  assert.deepEqual(r, []);
});

test("nota de SAÍDA não cobre a exigência de entrada", () => {
  const r = veiculosSemEntrada(
    [CARRO_COM_ENTRADA],
    [nota("v-entrada", 1, { operacao: "saida" })]
  );
  assert.deepEqual(r.map((v) => v.id), ["v-entrada"]);
});

test("a nota de um carro não silencia outro", () => {
  const r = veiculosSemEntrada(
    [CARRO_NOVO, CARRO_COM_ENTRADA],
    [nota("v-entrada", 1)]
  );
  assert.deepEqual(r.map((v) => v.id), ["v-novo"]);
});

test("ciclo ausente vale 1 nos dois lados — banco sem a migration não some com o carro", () => {
  // `ciclo` é `not null default 1` nas duas tabelas, mas a tela também roda
  // contra dados vindos de fora do banco (testes, mocks) — o fallback impede
  // que um `undefined` de um lado e um 1 do outro deixem de casar.
  assert.deepEqual(veiculosSemEntrada([{ id: "x" }], [nota("x", undefined)]), []);
  assert.deepEqual(veiculosSemEntrada([{ id: "x" }], [nota("x", 1)]), []);
  assert.deepEqual(veiculosSemEntrada([{ id: "x", ciclo: 1 }], [nota("x", undefined)]), []);
});

test("listas vazias ou ausentes não estouram", () => {
  assert.deepEqual(veiculosSemEntrada([], []), []);
  assert.deepEqual(veiculosSemEntrada(undefined, undefined), []);
});
