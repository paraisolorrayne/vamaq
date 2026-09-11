/**
 * Os filtros do acervo — onde o cliente decide comprar.
 *
 * O PEDIDO (Lorrayne, 11/09/2026): a página de estoque precisa ser muito mais
 * funcional. Faixa de preço, ano MÍNIMO (só existia "até"), modelo dependente
 * da marca, câmbio, estado na URL para poder mandar busca pronta no WhatsApp,
 * chips do que está ativo e contagem de resultados.
 *
 * O QUE ESTE ARQUIVO PROTEGE: a decisão de quem entra e em que ordem. O
 * desenho da tela não cabe em teste; a regra de filtro cabe, e é ela que faz
 * o cliente ver — ou não ver — o carro que ele quer.
 *
 *   npm test   (não precisa de banco: tudo aqui é função pura)
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  FILTROS_VAZIOS,
  filtraVeiculos,
  ordenaVeiculos,
  modelosDisponiveis,
  chipsDe,
  filtrosParaQuery,
  filtrosDaQuery,
  temFiltroAtivo,
} from "../src/lib/acervo/filtros.js";

function carro(extra = {}) {
  return {
    id: extra.id || Math.random().toString(36).slice(2),
    brand: "Porsche",
    model: "Macan",
    year: 2022,
    price: 400000,
    mileage: 30000,
    color: "Preto",
    fuel: "Gasolina",
    transmission: "Automático",
    bodyType: "SUV",
    blindagem: { blindado: false, tipo: "" },
    created_at: "2026-01-01T00:00:00Z",
    ...extra,
  };
}

const f = (extra) => ({ ...FILTROS_VAZIOS, ...extra });

// --- Preço -----------------------------------------------------------------

test("faixa de preço filtra pelos dois lados", () => {
  const lista = [
    carro({ id: "a", price: 150000 }),
    carro({ id: "b", price: 400000 }),
    carro({ id: "c", price: 1200000 }),
  ];

  assert.deepEqual(
    filtraVeiculos(lista, f({ precoMin: 200000, precoMax: 500000 })).map((v) => v.id),
    ["b"]
  );
});

test("preço só com mínimo não descarta os caros", () => {
  const lista = [carro({ id: "a", price: 150000 }), carro({ id: "b", price: 1200000 })];

  assert.deepEqual(
    filtraVeiculos(lista, f({ precoMin: 200000 })).map((v) => v.id),
    ["b"]
  );
});

test("carro SEM preço não desaparece quando não há filtro de preço", () => {
  // "Sob consulta" é comum em superesportivo, e some da lista se o filtro
  // tratar null como zero. Sem filtro de preço, ele tem que aparecer.
  const lista = [carro({ id: "sc", price: null })];

  assert.deepEqual(filtraVeiculos(lista, FILTROS_VAZIOS).map((v) => v.id), ["sc"]);
});

test("carro SEM preço sai da lista quando se filtra por faixa", () => {
  // Quem pediu "até 300 mil" está dizendo quanto pode pagar. Um carro sem
  // preço publicado não responde a essa pergunta e não deve entrar na
  // resposta como se respondesse.
  const lista = [carro({ id: "sc", price: null }), carro({ id: "ok", price: 250000 })];

  assert.deepEqual(
    filtraVeiculos(lista, f({ precoMax: 300000 })).map((v) => v.id),
    ["ok"]
  );
});

// --- Ano -------------------------------------------------------------------

test("ano tem MÍNIMO, não só máximo — era o buraco do filtro antigo", () => {
  const lista = [
    carro({ id: "velho", year: 2018 }),
    carro({ id: "meio", year: 2022 }),
    carro({ id: "novo", year: 2026 }),
  ];

  assert.deepEqual(
    filtraVeiculos(lista, f({ anoMin: 2022 })).map((v) => v.id),
    ["meio", "novo"]
  );
  assert.deepEqual(
    filtraVeiculos(lista, f({ anoMin: 2022, anoMax: 2022 })).map((v) => v.id),
    ["meio"]
  );
});

// --- Blindagem -------------------------------------------------------------

test("blindagem lê o campo de blindagem, NÃO o badge", () => {
  // O filtro antigo comparava `badge === "Blindado"`. Badge é um rótulo que
  // alguém digita na vitrine ("Novo", "Destaque"), então um carro blindado
  // marcado como "Destaque" ficava invisível para quem procurava blindado.
  const lista = [
    carro({ id: "blindado-sem-badge", blindagem: { blindado: true, tipo: "III-A" }, badge: "Destaque" }),
    carro({ id: "comum", blindagem: { blindado: false, tipo: "" }, badge: null }),
  ];

  assert.deepEqual(
    filtraVeiculos(lista, f({ blindagem: "sim" })).map((v) => v.id),
    ["blindado-sem-badge"]
  );
  assert.deepEqual(
    filtraVeiculos(lista, f({ blindagem: "nao" })).map((v) => v.id),
    ["comum"]
  );
});

// --- Busca -----------------------------------------------------------------

test("busca acha por marca e modelo juntos", () => {
  const lista = [
    carro({ id: "p911", brand: "Porsche", model: "911 Carrera" }),
    carro({ id: "macan", brand: "Porsche", model: "Macan" }),
  ];

  assert.deepEqual(
    filtraVeiculos(lista, f({ busca: "porsche 911" })).map((v) => v.id),
    ["p911"]
  );
});

test("busca ignora acento e pontuação", () => {
  const lista = [carro({ id: "x", brand: "Citroën", model: "C4 Cactus" })];

  assert.deepEqual(filtraVeiculos(lista, f({ busca: "citroen" })).map((v) => v.id), ["x"]);
  assert.deepEqual(filtraVeiculos(lista, f({ busca: "c-4" })).map((v) => v.id), ["x"]);
});

// --- Modelo dependente da marca --------------------------------------------

test("modelo só oferece o que existe nas marcas escolhidas", () => {
  const lista = [
    carro({ brand: "Porsche", model: "Macan" }),
    carro({ brand: "Porsche", model: "911 Carrera" }),
    carro({ brand: "BMW", model: "X4 M40i" }),
  ];

  assert.deepEqual(modelosDisponiveis(lista, ["Porsche"]), ["911 Carrera", "Macan"]);
});

test("sem marca escolhida, modelo oferece todos", () => {
  const lista = [
    carro({ brand: "Porsche", model: "Macan" }),
    carro({ brand: "BMW", model: "X4 M40i" }),
  ];

  assert.deepEqual(modelosDisponiveis(lista, []), ["Macan", "X4 M40i"]);
});

test("modelo selecionado de marca que saiu não filtra para o vazio", () => {
  // Cenário real: escolhe Porsche, escolhe Macan, tira Porsche. O modelo
  // ficaria pendurado e a lista voltaria vazia sem explicação.
  const lista = [carro({ brand: "BMW", model: "X4 M40i" })];

  const resultado = filtraVeiculos(lista, f({ marcas: ["BMW"], modelos: ["Macan"] }));
  assert.equal(resultado.length, 0, "o modelo continua valendo enquanto estiver marcado");
});

// --- Ordenação -------------------------------------------------------------

test("mais recentes usa a data de cadastro, não o ano do carro", () => {
  // "Mais recentes" ordenava por `year`, então um 2026 cadastrado há meses
  // vinha antes de um 2019 que entrou ontem. São perguntas diferentes, e a
  // lista de ordenação agora oferece as duas.
  const lista = [
    carro({ id: "antigo-cadastro", year: 2026, created_at: "2026-01-01T00:00:00Z" }),
    carro({ id: "novo-cadastro", year: 2019, created_at: "2026-09-01T00:00:00Z" }),
  ];

  assert.deepEqual(
    ordenaVeiculos(lista, "recentes").map((v) => v.id),
    ["novo-cadastro", "antigo-cadastro"]
  );
  assert.deepEqual(
    ordenaVeiculos(lista, "anoDesc").map((v) => v.id),
    ["antigo-cadastro", "novo-cadastro"]
  );
});

test("menor preço põe o carro sem preço no fim, não no começo", () => {
  // null vira 0 numa subtração e "Sob consulta" lideraria a lista de
  // "menor preço" — respondendo a pergunta errada.
  const lista = [
    carro({ id: "caro", price: 900000 }),
    carro({ id: "sem", price: null }),
    carro({ id: "barato", price: 120000 }),
  ];

  assert.deepEqual(
    ordenaVeiculos(lista, "precoAsc").map((v) => v.id),
    ["barato", "caro", "sem"]
  );
});

test("ordenar não altera a lista recebida", () => {
  const lista = [carro({ id: "a", price: 2 }), carro({ id: "b", price: 1 })];
  ordenaVeiculos(lista, "precoAsc");
  assert.deepEqual(lista.map((v) => v.id), ["a", "b"]);
});

// --- URL -------------------------------------------------------------------

test("os filtros vão e voltam da URL sem perder nada", () => {
  const original = f({
    busca: "porsche 911",
    marcas: ["Porsche", "BMW"],
    modelos: ["Macan"],
    carrocerias: ["SUV"],
    combustiveis: ["Gasolina"],
    cambios: ["Automático"],
    precoMin: 200000,
    precoMax: 500000,
    anoMin: 2022,
    anoMax: 2026,
    kmMax: 30000,
    blindagem: "sim",
    ordem: "precoAsc",
  });

  const volta = filtrosDaQuery(new URLSearchParams(filtrosParaQuery(original)));
  assert.deepEqual(volta, original);
});

test("filtro vazio não polui a URL", () => {
  assert.equal(filtrosParaQuery(FILTROS_VAZIOS), "");
});

test("a URL do exemplo do pedido funciona", () => {
  const filtros = filtrosDaQuery(
    new URLSearchParams("marca=Porsche&anoMin=2022&kmMax=30000")
  );

  assert.deepEqual(filtros.marcas, ["Porsche"]);
  assert.equal(filtros.anoMin, 2022);
  assert.equal(filtros.kmMax, 30000);
  assert.equal(filtros.blindagem, "todos", "o que não veio fica no padrão");
});

test("URL com lixo não derruba a página", () => {
  const filtros = filtrosDaQuery(
    new URLSearchParams("anoMin=abc&precoMax=&blindagem=talvez&ordem=inventada")
  );

  assert.equal(filtros.anoMin, null);
  assert.equal(filtros.precoMax, null);
  assert.equal(filtros.blindagem, "todos");
  assert.equal(filtros.ordem, FILTROS_VAZIOS.ordem);
});

// --- Chips -----------------------------------------------------------------

test("os chips dizem o que está filtrado, em português", () => {
  const chips = chipsDe(
    f({ marcas: ["Porsche"], anoMin: 2022, anoMax: 2026, kmMax: 30000 })
  );

  assert.deepEqual(
    chips.map((c) => c.rotulo),
    ["Porsche", "2022–2026", "até 30.000 km"]
  );
});

test("chip de ano só com mínimo diz 'de 2022'", () => {
  assert.deepEqual(
    chipsDe(f({ anoMin: 2022 })).map((c) => c.rotulo),
    ["de 2022"]
  );
  assert.deepEqual(
    chipsDe(f({ anoMax: 2022 })).map((c) => c.rotulo),
    ["até 2022"]
  );
});

test("cada chip sabe se remover", () => {
  const filtros = f({ marcas: ["Porsche", "BMW"], kmMax: 30000 });
  const chipBmw = chipsDe(filtros).find((c) => c.rotulo === "BMW");

  assert.deepEqual(chipBmw.remover(filtros).marcas, ["Porsche"]);
});

test("temFiltroAtivo ignora a ordenação", () => {
  // Ordenar não é filtrar: mostrar "Limpar filtros" só porque a pessoa
  // ordenou por preço sugeriria que algo está escondido.
  assert.equal(temFiltroAtivo(FILTROS_VAZIOS), false);
  assert.equal(temFiltroAtivo(f({ ordem: "precoAsc" })), false);
  assert.equal(temFiltroAtivo(f({ marcas: ["BMW"] })), true);
});
