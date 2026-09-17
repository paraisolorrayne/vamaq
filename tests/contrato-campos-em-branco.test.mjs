/**
 * A tela avisa quais campos do contrato saíram em branco — e só oferece os
 * campos que a forma de pagamento escolhida usa.
 *
 * O PEDIDO (Mayra, 17/09/2026, por áudio): "hoje eu vou fazer um contrato que
 * é aquele que põe um pouco financiado e um pouco à vista (...) mesmo colocando
 * ele personalizado, colocando as informações, o valor à vista, o valor
 * financiado, não está puxando a informação. Se eu preencher e não colocar nada
 * escrito, ele vai puxar a vista, só a vista."
 *
 * O DEFEITO: não é falta de recurso — "Financiamento bancário" já monta a
 * cláusula com entrada + financiado desde 08/09. É a TELA que engana: Entrada,
 * Valor Financiado e Instituição ficam sempre visíveis, mesmo com a forma em
 * "À vista / PIX" (o padrão que a tela seleciona sozinha). Preenchidos ali,
 * eles são silenciosamente descartados pelo build() e o contrato afirma um
 * pagamento à vista que não houve. O caminho inverso também engana: em
 * "Personalizado" os mesmos três campos continuam à mostra e também são
 * descartados — só o texto livre entra.
 *
 * O DESENHO: um campo que não vai para o contrato não fica na tela (`showIf`),
 * e o que ficou em branco é dito por nome antes de baixar o PDF — porque um
 * campo vazio não some do contrato, vira "_______________" no meio da cláusula.
 *
 *   npm test   (não precisa de banco: build() e camposEmBranco() são puros)
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./tests/helpers/mock-session-loader.mjs", pathToFileURL("./"));

import { test } from "node:test";
import assert from "node:assert/strict";

const { DEFAULT_TEMPLATES, camposEmBranco, camposVisiveis } = await import(
  "../src/lib/contractTemplates.js"
);

const venda = DEFAULT_TEMPLATES.find((t) => t.id === "venda");

/** Os valores como a tela nasce: todo campo vazio, todo select no options[0]. */
function valoresIniciais(template) {
  return Object.fromEntries(
    template.fields.map((f) => [f.key, f.type === "select" ? f.options?.[0] || "" : ""])
  );
}

const BASE = {
  ...valoresIniciais(venda),
  comprador_nome: "João da Silva",
  comprador_cpf: "529.982.247-25",
  veiculo_marca: "Toyota",
  veiculo_modelo: "Corolla XEI",
  valor_total: "107.000,00",
  data_contrato: "2026-09-17",
};

const chaves = (campos) => campos.map((c) => c.key);

// --- Campos que a forma de pagamento não usa somem da tela ------------------

const FINANCIAMENTO = ["venda_entrada", "venda_valor_financiado", "venda_instituicao_financeira"];

test("à vista não mostra os campos do financiamento nem o texto personalizado", () => {
  const vistos = chaves(camposVisiveis(venda.fields, BASE));

  for (const k of [...FINANCIAMENTO, "venda_pagamento_descricao"]) {
    assert.ok(!vistos.includes(k), `${k} não entra no contrato à vista, então não fica na tela`);
  }
});

test("sem forma escolhida vale o mesmo que à vista — é o padrão da tela", () => {
  const semEscolha = chaves(camposVisiveis(venda.fields, { ...BASE, venda_forma_pagamento: "" }));
  const aVista = chaves(camposVisiveis(venda.fields, BASE));

  assert.deepEqual(semEscolha, aVista);
});

test("financiamento mostra entrada, valor financiado e instituição", () => {
  const vistos = chaves(
    camposVisiveis(venda.fields, { ...BASE, venda_forma_pagamento: "Financiamento bancário" })
  );

  for (const k of FINANCIAMENTO) assert.ok(vistos.includes(k), `faltou ${k} no financiamento`);
  assert.ok(!vistos.includes("venda_pagamento_descricao"));
});

test("personalizado mostra só o texto livre — os valores do financiamento são descartados lá", () => {
  const vistos = chaves(
    camposVisiveis(venda.fields, { ...BASE, venda_forma_pagamento: "Personalizado" })
  );

  assert.ok(vistos.includes("venda_pagamento_descricao"));
  for (const k of FINANCIAMENTO) {
    assert.ok(!vistos.includes(k), `${k} não vai para a cláusula personalizada`);
  }
});

test("campo sem showIf continua sempre na tela", () => {
  const vistos = chaves(camposVisiveis(venda.fields, BASE));

  assert.ok(vistos.includes("comprador_nome"));
  assert.ok(vistos.includes("valor_total"));
  assert.ok(vistos.includes("venda_forma_pagamento"), "o próprio seletor nunca some");
});

test("a ordem e as seções dos campos não mudam ao filtrar", () => {
  const todos = chaves(venda.fields);
  const vistos = chaves(camposVisiveis(venda.fields, BASE));

  assert.deepEqual(vistos, todos.filter((k) => vistos.includes(k)));
});

// --- O que saiu em branco é dito por nome -----------------------------------

test("campo em branco é devolvido com o rótulo que a operadora vê na tela", () => {
  const values = { ...BASE, venda_forma_pagamento: "Financiamento bancário" };
  const pendentes = camposEmBranco(venda.build(values), venda.fields, values);

  const instituicao = pendentes.find((c) => c.key === "venda_instituicao_financeira");
  assert.ok(instituicao, "instituição ficou em branco e não foi avisada");
  assert.equal(instituicao.label, "Instituição Financeira");
});

// O build() NÃO substitui os placeholders — quem faz isso é a rota de geração,
// com o próprio `values`. Um campo preenchido segue como `{{chave}}` no corpo,
// então olhar só o texto acusaria de lacuna o contrato inteiro.
test("campo preenchido não é acusado de lacuna só porque o corpo ainda tem o placeholder", () => {
  const values = { ...BASE, venda_forma_pagamento: "Financiamento bancário" };
  const corpo = venda.build(values);

  assert.ok(corpo.includes("{{comprador_nome}}"), "premissa do teste mudou: o corpo já vem preenchido");
  assert.ok(
    !chaves(camposEmBranco(corpo, venda.fields, values)).includes("comprador_nome"),
    "comprador_nome foi digitado — a rota vai preencher, não é lacuna"
  );
});

test("contrato com tudo preenchido não acusa pendência nenhuma", () => {
  const values = Object.fromEntries(
    venda.fields.map((f) => [f.key, f.type === "select" ? f.options?.[0] || "" : "preenchido"])
  );
  const pendentes = camposEmBranco(venda.build(values), venda.fields, values);

  assert.deepEqual(pendentes, [], `sobrou em branco: ${chaves(pendentes).join(", ")}`);
});

test("o mesmo campo citado duas vezes no contrato é avisado uma vez só", () => {
  const corpo = "Fica {{comprador_nome}} obrigado, e {{comprador_nome}} declara.";
  const pendentes = camposEmBranco(corpo, venda.fields, {});

  assert.deepEqual(chaves(pendentes), ["comprador_nome"]);
});

test("a ordem do aviso segue a ordem do formulário, não a do texto", () => {
  const corpo = "{{valor_total}} ... {{comprador_nome}}";
  const pendentes = camposEmBranco(corpo, venda.fields, {});

  assert.deepEqual(chaves(pendentes), ["comprador_nome", "valor_total"]);
});

test("placeholder sem campo correspondente não quebra o aviso", () => {
  const pendentes = camposEmBranco("Nada aqui: {{campo_que_nao_existe}}", venda.fields, {});

  assert.deepEqual(pendentes, []);
});

test("texto sem placeholder nenhum devolve lista vazia", () => {
  assert.deepEqual(camposEmBranco("Contrato completo, sem lacuna.", venda.fields, {}), []);
});

test("só espaço em branco digitado continua sendo lacuna", () => {
  const pendentes = camposEmBranco("{{comprador_nome}}", venda.fields, { comprador_nome: "   " });

  assert.deepEqual(chaves(pendentes), ["comprador_nome"]);
});
