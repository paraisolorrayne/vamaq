import { test } from "node:test";
import assert from "node:assert/strict";
import { telefoneWhatsapp } from "../src/lib/crm/telefone.js";

test("telefone com máscara (DDD + celular) ganha o DDI 55", () => {
  assert.equal(telefoneWhatsapp("(34) 99988-7766"), "5534999887766");
});

test("telefone só dígitos (DDD + celular) ganha o DDI 55", () => {
  assert.equal(telefoneWhatsapp("34999887766"), "5534999887766");
});

test("telefone fixo (DDD + 8 dígitos) também ganha o DDI 55", () => {
  assert.equal(telefoneWhatsapp("3433334444"), "553433334444");
});

test("telefone que já tem DDI 55 não muda", () => {
  assert.equal(telefoneWhatsapp("5534997353315"), "5534997353315");
});

test("vazio, nulo, indefinido ou curto demais não dá para adivinhar", () => {
  assert.equal(telefoneWhatsapp(""), null);
  assert.equal(telefoneWhatsapp(null), null);
  assert.equal(telefoneWhatsapp(undefined), null);
  assert.equal(telefoneWhatsapp("123"), null);
  assert.equal(telefoneWhatsapp("abc"), null);
});

test("longo demais ou com DDI de outro país não vira link", () => {
  assert.equal(telefoneWhatsapp("349998877766123"), null); // 15 dígitos
  assert.equal(telefoneWhatsapp("1234567890123"), null); // 13 dígitos, mas não começa com 55
});

test("saída, quando não nula, sempre tem DDI 55 e 12 ou 13 dígitos", () => {
  const casos = ["(34) 99988-7766", "34999887766", "3433334444", "5534997353315"];
  for (const c of casos) {
    const r = telefoneWhatsapp(c);
    assert.notEqual(r, null);
    assert.ok(r.length === 12 || r.length === 13, `esperava 12 ou 13 dígitos, veio ${r.length}`);
    assert.ok(r.startsWith("55"), `esperava começar com 55, veio ${r}`);
  }
});
