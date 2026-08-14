/**
 * Plano de contas: numeração, ordem e nome das categorias criadas pela loja.
 *
 * O que este arquivo protege: o DRE e a margem por veículo agrupam por PREFIXO
 * de código. Uma categoria que nasce no ramo errado — ou que reaproveita o
 * código de uma conta desativada — não dá erro nenhum: só faz o resultado do
 * mês mostrar um número diferente do real.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GRUPOS,
  grupoPorId,
  ordenaContas,
  partesDoCodigo,
  proximoCodigo,
  validaNomeConta,
} from "../src/lib/fin/planoContas.js";

const PLANO = [
  { code: "3.1", name: "Venda de Veículos" },
  { code: "4.1", name: "Custo de Aquisição de Veículos" },
  { code: "4.2", name: "Preparação e Reparos" },
  { code: "5.1.1", name: "Pró-labore" },
  { code: "5.1.2", name: "Salários e Encargos" },
  { code: "5.1.6", name: "Softwares e Sistemas" },
  { code: "5.2.1", name: "Marketing" },
];

test("próximo código continua a numeração do grupo", () => {
  assert.equal(proximoCodigo("5.1", PLANO), "5.1.7");
  assert.equal(proximoCodigo("5.2", PLANO), "5.2.2");
});

test("grupo ainda sem filhos começa no 1", () => {
  assert.equal(proximoCodigo("5.3", PLANO), "5.3.1");
  assert.equal(proximoCodigo("4.2", PLANO), "4.2.1");
});

test("só filhos diretos contam — neto não empurra a numeração", () => {
  // Se o contador criar 5.1.3.2 um dia, o próximo de 5.1 continua sendo 5.1.7.
  const com_neto = [...PLANO, { code: "5.1.3.2", name: "Sub-conta do contador" }];
  assert.equal(proximoCodigo("5.1", com_neto), "5.1.7");
});

test("conta de outro ramo não interfere", () => {
  assert.equal(proximoCodigo("5.2", [...PLANO, { code: "5.1.9", name: "X" }]), "5.2.2");
});

test("código não numérico é ignorado em vez de derrubar a numeração", () => {
  const sujo = [...PLANO, { code: "5.1.A", name: "Importada torta" }, { code: null, name: "Sem código" }];
  assert.equal(proximoCodigo("5.1", sujo), "5.1.7");
});

test("ordem natural: 5.1.2 vem antes de 5.1.10", () => {
  // Ordenado como texto, "5.1.10" cairia entre 5.1.1 e 5.1.2 e sumiria da vista.
  const contas = [
    { code: "5.1.10", name: "Tonner" },
    { code: "5.1.2", name: "Salários" },
    { code: "5.1.1", name: "Pró-labore" },
  ];
  assert.deepEqual(ordenaContas(contas).map((c) => c.code), ["5.1.1", "5.1.2", "5.1.10"]);
});

test("conta sem código vai para o fim, em ordem alfabética", () => {
  const contas = [
    { code: null, name: "Zebra" },
    { code: null, name: "Abacaxi" },
    { code: "5.1.1", name: "Pró-labore" },
  ];
  assert.deepEqual(ordenaContas(contas).map((c) => c.name), ["Pró-labore", "Abacaxi", "Zebra"]);
});

test("ordenaContas não altera a lista recebida", () => {
  const original = [{ code: "5.1.2", name: "B" }, { code: "5.1.1", name: "A" }];
  const copia = [...original];
  ordenaContas(original);
  assert.deepEqual(original, copia);
});

test("partesDoCodigo separa o que é numérico do que não é", () => {
  assert.deepEqual(partesDoCodigo("5.1.10"), [5, 1, 10]);
  assert.equal(partesDoCodigo("5.1.A"), null);
  assert.equal(partesDoCodigo(""), null);
  assert.equal(partesDoCodigo(null), null);
});

// --- Nome da categoria ---

const ADM = grupoPorId("administrativa");

test("nome válido é aparado e aceito", () => {
  assert.deepEqual(validaNomeConta("  Material   de escritório ", ADM, PLANO), {
    nome: "Material de escritório",
  });
});

test("nome vazio ou curto demais é recusado", () => {
  for (const ruim of ["", "   ", "a", null, undefined]) {
    assert.ok(validaNomeConta(ruim, ADM, PLANO).error, JSON.stringify(ruim));
  }
});

test("duplicata no mesmo grupo é recusada, ignorando caixa e espaço", () => {
  const contas = [...PLANO, { code: "5.1.7", name: "Material de escritório" }];
  const r = validaNomeConta("  MATERIAL DE ESCRITÓRIO ", ADM, contas);
  assert.ok(r.error);
  assert.match(r.error, /já existe/i);
});

test("mesmo nome em grupo diferente é permitido", () => {
  // "Alimentação" administrativa e "Alimentação" comercial (evento com cliente)
  // são coisas diferentes no DRE.
  const contas = [...PLANO, { code: "5.1.7", name: "Alimentação" }];
  assert.deepEqual(validaNomeConta("Alimentação", grupoPorId("comercial"), contas), {
    nome: "Alimentação",
  });
});

test("sem grupo escolhido, recusa", () => {
  assert.ok(validaNomeConta("Brindes", null, PLANO).error);
});

// --- Os grupos oferecidos ---

test("nenhum grupo deixa criar conta embaixo de 4.1", () => {
  // 4.1 é o custo de aquisição do veículo, casado com `code like '4.1%'` no
  // cálculo da margem. Uma despesa qualquer criada ali viraria "preço de compra
  // do carro" e mudaria a margem de todo veículo ligado a ela.
  for (const g of GRUPOS) {
    assert.ok(!g.prefixo.startsWith("4.1"), `grupo ${g.id} nasce dentro de 4.1`);
  }
});

test("todo grupo tem tipo válido e prefixo numérico", () => {
  for (const g of GRUPOS) {
    assert.ok(["revenue", "expense"].includes(g.tipo), g.id);
    assert.ok(partesDoCodigo(g.prefixo), `prefixo de ${g.id} não é numérico`);
    assert.ok(g.rotulo && g.ajuda, `grupo ${g.id} sem texto de tela`);
  }
});

test("grupo de receita nasce em 3 e os de despesa não", () => {
  assert.equal(grupoPorId("receita").prefixo, "3");
  assert.equal(grupoPorId("receita").tipo, "revenue");
  for (const g of GRUPOS.filter((x) => x.tipo === "expense")) {
    assert.ok(!g.prefixo.startsWith("3"), g.id);
  }
});
