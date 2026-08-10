import { test } from "node:test";
import assert from "node:assert/strict";
import { dadosDoCliente, precisaVincular, podeOferecerCadastro } from "../src/lib/crm/vinculoCliente.js";

test("dadosDoCliente: cliente completo copia os quatro campos", () => {
  const cliente = { id: "c1", nome: "Maria Souza", telefone: "34999887766", email: "maria@ex.com" };
  assert.deepEqual(dadosDoCliente(cliente), {
    cliente_id: "c1",
    cliente_nome: "Maria Souza",
    telefone: "34999887766",
    email: "maria@ex.com",
  });
});

test("dadosDoCliente: sem telefone e sem e-mail vira string vazia, nunca undefined", () => {
  const r = dadosDoCliente({ id: "c2", nome: "João" });
  assert.equal(r.telefone, "");
  assert.equal(r.email, "");
  assert.notEqual(r.telefone, undefined);
  assert.notEqual(r.email, undefined);
});

test("dadosDoCliente: cliente null não quebra e devolve campos vazios", () => {
  assert.deepEqual(dadosDoCliente(null), {
    cliente_id: null,
    cliente_nome: "",
    telefone: "",
    email: "",
  });
});

test("dadosDoCliente: nome com espaços em volta vem aparado", () => {
  const r = dadosDoCliente({ id: "c3", nome: "  Carlos Lima  " });
  assert.equal(r.cliente_nome, "Carlos Lima");
});

test("precisaVincular: com cliente_id não precisa vincular", () => {
  assert.equal(precisaVincular({ cliente_id: "c1" }), false);
});

test("precisaVincular: sem cliente_id precisa vincular", () => {
  assert.equal(precisaVincular({ cliente_nome: "Maria" }), true);
});

test("precisaVincular: cliente_id vazio (string) ainda precisa vincular", () => {
  assert.equal(precisaVincular({ cliente_id: "" }), true);
});

test("precisaVincular: oportunidade null precisa vincular", () => {
  assert.equal(precisaVincular(null), true);
});

// podeOferecerCadastro: item 2 do fix-duplicado-report.md — a busca que
// falhou (fetch estourando no pátio, 3G ruim) não pode virar convite para
// cadastrar um duplicado do cliente que ela nunca conseguiu procurar.
test("podeOferecerCadastro: com resultados, não oferece", () => {
  assert.equal(
    podeOferecerCadastro({ termo: "Carlos", buscando: false, erro: "", resultados: [{ id: "1" }] }),
    false
  );
});

test("podeOferecerCadastro: sem resultados e sem erro, oferece — a única situação que oferece", () => {
  assert.equal(
    podeOferecerCadastro({ termo: "Carlos", buscando: false, erro: "", resultados: [] }),
    true
  );
});

test("podeOferecerCadastro: com erro, não oferece mesmo sem resultados", () => {
  assert.equal(
    podeOferecerCadastro({
      termo: "Carlos",
      buscando: false,
      erro: "Não foi possível buscar clientes agora.",
      resultados: [],
    }),
    false
  );
});

test("podeOferecerCadastro: buscando, não oferece", () => {
  assert.equal(
    podeOferecerCadastro({ termo: "Carlos", buscando: true, erro: "", resultados: [] }),
    false
  );
});

test("podeOferecerCadastro: termo vazio, não oferece", () => {
  assert.equal(
    podeOferecerCadastro({ termo: "   ", buscando: false, erro: "", resultados: [] }),
    false
  );
});
