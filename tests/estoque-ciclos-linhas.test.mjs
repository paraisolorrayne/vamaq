/**
 * O relatório de entradas e saídas mostra TODOS os ciclos do carro.
 *
 * O ciclo corrente vive nas colunas de `vehicles`; os encerrados, em
 * `vehicle_ciclos`. Sem unir os dois, a compra original do carro que voltou na
 * troca desaparece do relatório — e ele é o registro de entrada e saída do pátio.
 *
 *   npm test   (função pura, sem banco)
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { linhasComCiclos } from "../src/lib/estoque/ciclosDoVeiculo.js";

const CARRO = {
  id: "v1", brand: "Audi", model: "Q5", year: 2022, ano_modelo: 2023,
  placa: "ABC1D23", chassi: "9BW", status: "disponivel", ciclo: 2,
  data_entrada: "2026-09-17", data_saida: null,
};

test("carro em ciclo único dá uma linha, como antes", () => {
  const linhas = linhasComCiclos({
    veiculos: [{ ...CARRO, ciclo: 1, data_saida: "2026-06-20" }],
    ciclos: [],
    margens: [],
  });

  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].ciclo, 1);
  assert.equal(linhas[0].data_saida, "2026-06-20");
});

test("carro que voltou na troca dá uma linha por ciclo, na ordem", () => {
  const linhas = linhasComCiclos({
    veiculos: [CARRO],
    ciclos: [
      { vehicle_id: "v1", ciclo: 1, data_entrada: "2026-01-10", data_saida: "2026-06-20", price: 200000 },
    ],
    margens: [],
  });

  assert.equal(linhas.length, 2);
  assert.deepEqual(linhas.map((l) => l.ciclo), [1, 2]);
  assert.equal(linhas[0].data_entrada, "2026-01-10", "a compra original não pode sumir");
  assert.equal(linhas[0].data_saida, "2026-06-20");
  assert.equal(linhas[1].data_entrada, "2026-09-17");
  assert.equal(linhas[1].data_saida, null);
});

test("cada linha casa a margem do seu ciclo", () => {
  const linhas = linhasComCiclos({
    veiculos: [CARRO],
    ciclos: [{ vehicle_id: "v1", ciclo: 1, data_entrada: "2026-01-10", data_saida: "2026-06-20", price: 200000 }],
    margens: [
      { vehicle_id: "v1", ciclo: 1, custo_aquisicao: 150000, receita: 200000, resultado_liquido: 40000 },
      { vehicle_id: "v1", ciclo: 2, custo_aquisicao: 180000, receita: 0, resultado_liquido: -180000 },
    ],
  });

  assert.equal(linhas[0].compra, 150000);
  assert.equal(linhas[0].venda, 200000);
  assert.equal(linhas[1].compra, 180000);
  assert.equal(linhas[1].venda, null, "zero não é valor — ausência aparece como ausência");
});

test("carro sem lançamento não mostra R$ 0,00 na coluna Compra", () => {
  const linhas = linhasComCiclos({
    veiculos: [{ ...CARRO, ciclo: 1 }],
    ciclos: [],
    margens: [{ vehicle_id: "v1", ciclo: 1, custo_aquisicao: 0, receita: 0, resultado_liquido: 0 }],
  });

  assert.equal(linhas[0].compra, null);
  assert.equal(linhas[0].venda, null);
  assert.equal(linhas[0].resultado, null);
});

test("a linha diz quantos ciclos o carro tem, para a tela poder marcar", () => {
  const linhas = linhasComCiclos({
    veiculos: [CARRO],
    ciclos: [{ vehicle_id: "v1", ciclo: 1, data_entrada: "2026-01-10", data_saida: "2026-06-20", price: 200000 }],
    margens: [],
  });

  assert.equal(linhas[0].ciclosDoCarro, 2);
  assert.equal(linhas[1].ciclosDoCarro, 2);
});

test("ciclo de outro carro não vaza para este", () => {
  const linhas = linhasComCiclos({
    veiculos: [{ ...CARRO, ciclo: 1 }],
    ciclos: [{ vehicle_id: "OUTRO", ciclo: 1, data_entrada: "2026-01-10", data_saida: "2026-06-20", price: 9 }],
    margens: [],
  });

  assert.equal(linhas.length, 1);
});

test("sem veículo nenhum devolve lista vazia", () => {
  assert.deepEqual(linhasComCiclos({ veiculos: [], ciclos: [], margens: [] }), []);
  assert.deepEqual(linhasComCiclos({}), []);
});
