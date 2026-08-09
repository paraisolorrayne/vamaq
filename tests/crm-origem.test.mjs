import { test } from "node:test";
import assert from "node:assert/strict";
import { opcoesOrigem, ORIGENS } from "../src/lib/crm/origem.js";

test("origem que já está na lista fixa: opções são a lista, sem duplicar", () => {
  assert.deepEqual(opcoesOrigem("WhatsApp"), ORIGENS);
  // garante que não duplicou "WhatsApp"
  assert.equal(opcoesOrigem("WhatsApp").filter((o) => o === "WhatsApp").length, 1);
});

test("origem fora da lista: aparece como opção extra, no fim", () => {
  const opcoes = opcoesOrigem("Feira de exposição");
  assert.deepEqual(opcoes, [...ORIGENS, "Feira de exposição"]);
});

test('origem "" (nunca escolhida): opções são só a lista fixa', () => {
  assert.deepEqual(opcoesOrigem(""), ORIGENS);
});

test("origem null (sem valor gravado): opções são só a lista fixa", () => {
  assert.deepEqual(opcoesOrigem(null), ORIGENS);
});

test("origem undefined: opções são só a lista fixa", () => {
  assert.deepEqual(opcoesOrigem(undefined), ORIGENS);
});
