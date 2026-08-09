import { test } from "node:test";
import assert from "node:assert/strict";
import { proximaEtapa, rotuloEtapa, acoesDaEtapa } from "../src/lib/crm/etapas.js";

test("proximaEtapa percorre o funil na ordem", () => {
  assert.equal(proximaEtapa("novo"), "contato");
  assert.equal(proximaEtapa("contato"), "proposta");
  assert.equal(proximaEtapa("proposta"), "negociacao");
  assert.equal(proximaEtapa("negociacao"), "ganho");
});

test("as etapas terminais não têm próxima", () => {
  assert.equal(proximaEtapa("ganho"), null);
  assert.equal(proximaEtapa("perdido"), null);
});

test("etapa desconhecida ou vazia não tem próxima", () => {
  assert.equal(proximaEtapa("qualquer"), null);
  assert.equal(proximaEtapa(""), null);
  assert.equal(proximaEtapa(null), null);
});

test("rotuloEtapa devolve o nome por extenso", () => {
  assert.equal(rotuloEtapa("novo"), "Novo");
  assert.equal(rotuloEtapa("contato"), "Em contato");
  assert.equal(rotuloEtapa("proposta"), "Proposta");
  assert.equal(rotuloEtapa("negociacao"), "Negociação");
  assert.equal(rotuloEtapa("ganho"), "Ganho");
  assert.equal(rotuloEtapa("perdido"), "Perdido");
});

test("rotuloEtapa devolve o próprio valor se não conhecer a etapa", () => {
  assert.equal(rotuloEtapa("outra-coisa"), "outra-coisa");
  assert.equal(rotuloEtapa(""), "");
});

test("em novo: avança e pode perder, não vende", () => {
  const a = acoesDaEtapa({ etapa: "novo", vehicle_id: "abc", telefone: "34999" });
  assert.equal(a.avancarPara, "contato");
  assert.equal(a.podePerder, true);
  assert.equal(a.podeVender, false);
  assert.equal(a.podeReabrir, false);
});

test("em ganho COM veículo: vende, não avança", () => {
  const a = acoesDaEtapa({ etapa: "ganho", vehicle_id: "abc" });
  assert.equal(a.avancarPara, null);
  assert.equal(a.podeVender, true);
  assert.equal(a.podePerder, false);
});

test("em ganho SEM veículo ligado: NÃO oferece registrar venda", () => {
  const a = acoesDaEtapa({ etapa: "ganho", vehicle_id: null });
  assert.equal(a.podeVender, false);
});

test("em perdido: só reabrir", () => {
  const a = acoesDaEtapa({ etapa: "perdido", vehicle_id: "abc", telefone: "34999" });
  assert.equal(a.avancarPara, null);
  assert.equal(a.podePerder, false);
  assert.equal(a.podeVender, false);
  assert.equal(a.podeReabrir, true);
});

test("WhatsApp só aparece quando há telefone", () => {
  assert.equal(acoesDaEtapa({ etapa: "novo", telefone: "34999" }).podeWhatsapp, true);
  assert.equal(acoesDaEtapa({ etapa: "novo", telefone: "" }).podeWhatsapp, false);
  assert.equal(acoesDaEtapa({ etapa: "novo" }).podeWhatsapp, false);
});

test("oportunidade nula não quebra e não oferece nada", () => {
  const a = acoesDaEtapa(null);
  assert.equal(a.avancarPara, null);
  assert.equal(a.podeVender, false);
  assert.equal(a.podePerder, false);
  assert.equal(a.podeReabrir, false);
  assert.equal(a.podeWhatsapp, false);
});
