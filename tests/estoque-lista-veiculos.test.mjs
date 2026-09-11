/**
 * A lista de veículos em estoque que o vendedor exporta e manda pro cliente.
 *
 * O PEDIDO (Lorrayne, 11/09/2026): uma exportação do estoque completo no
 * formato da "Lista de Veículos na Loja" que a concorrência usa — uma tabela
 * por carro, com o total no fim.
 *
 * O QUE ESTE ARQUIVO PROTEGE: as regras da lista, não o desenho do PDF. Quem
 * entra (só o que está à venda), em que ordem, e como cada coluna é escrita —
 * inclusive os dois casos em que ausência de dado NÃO pode virar zero.
 *
 *   npm test   (não precisa de banco: linhasDaLista é função pura)
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { linhasDaLista, paginar } from "../src/lib/estoque/listaVeiculos.js";

const HOJE = "2026-09-11";

// Carro mínimo válido: os testes sobrescrevem só o campo que estão olhando.
function carro(extra = {}) {
  return {
    brand: "Porsche",
    model: "911 Carrera",
    year: 2025,
    ano_modelo: 2026,
    color: "Cinza",
    placa: "GHA-9E11",
    quilometragem: 3500,
    price: 1029000,
    status: "disponivel",
    data_entrada: "2026-07-18",
    opcionais: [],
    blindagem: { tipo: "", blindado: false },
    ...extra,
  };
}

test("só entra o que está à venda — vendido, reservado e inativo ficam de fora", () => {
  const linhas = linhasDaLista(
    [
      carro({ model: "Disponível", status: "disponivel" }),
      carro({ model: "Reservado", status: "reservado" }),
      carro({ model: "Vendido", status: "vendido" }),
      carro({ model: "Inativo", status: "inativo" }),
    ],
    { hoje: HOJE }
  );

  assert.deepEqual(
    linhas.map((l) => l.descricao),
    ["PORSCHE DISPONÍVEL"]
  );
});

test("a lista sai em ordem alfabética, como o modelo", () => {
  const linhas = linhasDaLista(
    [
      carro({ brand: "Volvo", model: "XC60" }),
      carro({ brand: "Audi", model: "Q5" }),
      carro({ brand: "Ferrari", model: "296 GTB" }),
    ],
    { hoje: HOJE }
  );

  assert.deepEqual(
    linhas.map((l) => l.descricao),
    ["AUDI Q5", "FERRARI 296 GTB", "VOLVO XC60"]
  );
});

test("Seq numera a lista já ordenada, a partir de 1", () => {
  const linhas = linhasDaLista(
    [carro({ brand: "Volvo" }), carro({ brand: "Audi" })],
    { hoje: HOJE }
  );

  assert.deepEqual(
    linhas.map((l) => l.seq),
    [1, 2]
  );
});

test("Ano/Model traz sempre os dois anos, mesmo iguais", () => {
  const [linha] = linhasDaLista([carro({ year: 2026, ano_modelo: 2026 })], {
    hoje: HOJE,
  });

  // A tela colapsa "2026/2026" em "2026" porque lá repetir é ruído. Aqui não:
  // a coluna do modelo é "Ano/Model" e mostra os dois em toda linha.
  assert.equal(linha.anoModelo, "2026/2026");
});

test("sem ano do modelo cadastrado, o ano de fabricação vale pelos dois", () => {
  const [linha] = linhasDaLista([carro({ year: 2020, ano_modelo: null })], {
    hoje: HOJE,
  });

  assert.equal(linha.anoModelo, "2020/2020");
});

test("blindagem vira BLINDADO com o tipo, na coluna Opcionais", () => {
  const [linha] = linhasDaLista(
    [carro({ blindagem: { blindado: true, tipo: "Carbon" } })],
    { hoje: HOJE }
  );

  assert.equal(linha.opcionais, "BLINDADO CARBON");
});

test("blindado sem tipo cadastrado sai só BLINDADO", () => {
  const [linha] = linhasDaLista(
    [carro({ blindagem: { blindado: true, tipo: "" } })],
    { hoje: HOJE }
  );

  assert.equal(linha.opcionais, "BLINDADO");
});

test("Qtd dias conta desde a entrada do carro no pátio", () => {
  const [linha] = linhasDaLista([carro({ data_entrada: "2026-08-22" })], {
    hoje: "2026-09-11",
  });

  assert.equal(linha.qtdDias, 20);
});

test("carro sem data de entrada deixa Qtd dias em branco, não zero", () => {
  // "0 dias" se lê como "entrou hoje". Ausência tem que aparecer como ausência
  // — mesma regra que a tela de entradas e saídas já segue para valores.
  const [linha] = linhasDaLista([carro({ data_entrada: null })], { hoje: HOJE });

  assert.equal(linha.qtdDias, "");
});

test("carro sem preço deixa o valor em branco, não R$ 0,00", () => {
  const [linha] = linhasDaLista([carro({ price: null })], { hoje: HOJE });

  assert.equal(linha.valor, "");
});

test("preço sai formatado em reais, sem o símbolo, como no modelo", () => {
  const [linha] = linhasDaLista([carro({ price: 2690000 })], { hoje: HOJE });

  assert.equal(linha.valor, "2.690.000,00");
});

test("zero quilômetro sai escrito 0km, não 0", () => {
  const [linha] = linhasDaLista([carro({ quilometragem: 0 })], { hoje: HOJE });

  assert.equal(linha.km, "0km");
});

test("quilometragem sai com separador de milhar", () => {
  const [linha] = linhasDaLista([carro({ quilometragem: 40500 })], {
    hoje: HOJE,
  });

  assert.equal(linha.km, "40.500");
});

test("carro sem quilometragem cadastrada deixa a coluna em branco", () => {
  const [linha] = linhasDaLista([carro({ quilometragem: null })], {
    hoje: HOJE,
  });

  assert.equal(linha.km, "");
});

// --- Paginação -------------------------------------------------------------
//
// O modelo cabe ~33 linhas na primeira página (que perde altura para o
// cabeçalho com logo e título) e ~36 nas seguintes. Errar isso é o defeito
// clássico: a última página nasce vazia, ou o total escorrega para uma folha
// sozinha.

test("lista curta cabe numa página só", () => {
  const paginas = paginar(linhasFalsas(10));

  assert.equal(paginas.length, 1);
  assert.equal(paginas[0].length, 10);
});

test("a primeira página cabe menos linhas, porque perde altura para o título", () => {
  const paginas = paginar(linhasFalsas(200));

  assert.ok(
    paginas[0].length < paginas[1].length,
    `primeira (${paginas[0].length}) deveria caber menos que a segunda (${paginas[1].length})`
  );
});

test("nenhuma linha se perde nem se repete na quebra de páginas", () => {
  const linhas = linhasFalsas(84);
  const paginas = paginar(linhas);

  assert.deepEqual(
    paginas.flat().map((l) => l.seq),
    linhas.map((l) => l.seq)
  );
});

test("não sobra página vazia no fim", () => {
  for (const total of [33, 34, 69, 70, 84]) {
    const paginas = paginar(linhasFalsas(total));
    assert.ok(
      paginas[paginas.length - 1].length > 0,
      `com ${total} carros a última página saiu vazia`
    );
  }
});

function linhasFalsas(n) {
  return Array.from({ length: n }, (_, i) => ({ seq: i + 1, descricao: `CARRO ${i + 1}` }));
}
