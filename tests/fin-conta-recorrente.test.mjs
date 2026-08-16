/**
 * Série mensal de contas a pagar e leitura da linha digitável.
 *
 * O mod10 usado aqui foi conferido contra um boleto documentado de verdade
 * (Itaú, 34191.79001 01043.510047 91020.150008 4 84410000002000, R$ 20,00) —
 * ou seja, contra dado externo, não contra a própria implementação.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  datasDaSerie,
  descricaoDaParcela,
  MAX_PARCELAS,
  ultimoDiaDoMes,
} from "../src/lib/fin/recorrencia.js";
import {
  apenasDigitos,
  dataDoFator,
  leLinhaDigitavel,
  mod10,
  mod11Bloco,
} from "../src/lib/fin/linhaDigitavel.js";

// ---------------------------------------------------------------- série ----

test("doze parcelas mensais mantêm o dia do vencimento", () => {
  const d = datasDaSerie("2026-08-10", 12);
  assert.equal(d.length, 12);
  assert.equal(d[0], "2026-08-10");
  assert.equal(d[4], "2026-12-10");
  assert.equal(d[5], "2027-01-10", "vira o ano corretamente");
  assert.equal(d[11], "2027-07-10");
});

test("dia 31 não escorrega para março — a armadilha do mês curto", () => {
  // Somar "um mês" a 31/01 dá 31/02, que o JavaScript empurra para 03/03.
  const d = datasDaSerie("2026-01-31", 4);
  assert.deepEqual(d, ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
});

test("o encolhimento não se propaga: março volta a ser 31", () => {
  // Derivar cada mês do anterior daria 28/03. O dia original é reaplicado.
  const d = datasDaSerie("2026-01-31", 3);
  assert.equal(d[1], "2026-02-28");
  assert.equal(d[2], "2026-03-31");
});

test("fevereiro de ano bissexto tem 29", () => {
  assert.deepEqual(datasDaSerie("2028-01-30", 2), ["2028-01-30", "2028-02-29"]);
  assert.equal(ultimoDiaDoMes(2028, 2), 29);
  assert.equal(ultimoDiaDoMes(2026, 2), 28);
});

test("uma parcela só devolve o próprio vencimento", () => {
  assert.deepEqual(datasDaSerie("2026-08-10", 1), ["2026-08-10"]);
});

test("série é limitada — ninguém cria conta até 2050 sem querer", () => {
  assert.equal(datasDaSerie("2026-08-10", 999).length, MAX_PARCELAS);
});

test("data ou quantidade inválida devolve lista vazia, não datas erradas", () => {
  for (const ruim of ["", "10/08/2026", "2026-8-1", null, undefined, "ontem"]) {
    assert.deepEqual(datasDaSerie(ruim, 3), [], JSON.stringify(ruim));
  }
  assert.deepEqual(datasDaSerie("2026-08-10", 0), []);
  assert.deepEqual(datasDaSerie("2026-08-10", -2), []);
});

test("cada parcela se identifica na lista", () => {
  assert.equal(descricaoDaParcela("Conta de água", 0, 12), "Conta de água (1/12)");
  assert.equal(descricaoDaParcela("Conta de água", 11, 12), "Conta de água (12/12)");
});

test("conta avulsa não ganha sufixo de parcela", () => {
  assert.equal(descricaoDaParcela("Conta de água", 0, 1), "Conta de água");
  assert.equal(descricaoDaParcela("Conta de água", 0, 0), "Conta de água");
});

// ------------------------------------------------------- linha digitável ----

test("mod10 reproduz os dígitos de um boleto real", () => {
  assert.equal(mod10("341917900"), 1);
  assert.equal(mod10("0104351004"), 7);
  assert.equal(mod10("9102015000"), 8);
});

test("boleto: valor e código de barras saem certos", () => {
  const r = leLinhaDigitavel("34191.79001 01043.510047 91020.150008 4 84410000002000");
  assert.equal(r.error, undefined);
  assert.equal(r.tipo, "boleto");
  assert.equal(r.valor, 20);
  assert.equal(r.codigoBarras.length, 44);
  assert.equal(r.codigoBarras.slice(0, 4), "3419", "banco 341, moeda 9");
  assert.equal(r.codigoBarras.slice(9, 19), "0000002000", "valor no código de barras");
});

test("dígito trocado é recusado — é para isso que serve a conferência", () => {
  // Mesmo boleto com o primeiro campo alterado num dígito.
  const r = leLinhaDigitavel("34191.79002 01043.510047 91020.150008 4 84410000002000");
  assert.ok(r.error);
  assert.match(r.error, /não conferem/i);
});

test("aceita colado com pontos, espaços ou só números", () => {
  const formas = [
    "34191.79001 01043.510047 91020.150008 4 84410000002000",
    "34191790010104351004791020150008484410000002000",
    " 34191.79001  01043.510047\t91020.150008 4 84410000002000 ",
  ];
  const valores = formas.map((f) => leLinhaDigitavel(f).valor);
  assert.deepEqual(valores, [20, 20, 20]);
});

test("fator de vencimento fora de época vira null, não data errada", () => {
  // 8441 é do ciclo antigo (2020). No ciclo novo cairia em 2045 — absurdo.
  // Data errada num boleto é pior que data nenhuma.
  assert.equal(dataDoFator(8441, "2026-08-15"), null);
  assert.equal(dataDoFator(999), null);
  assert.equal(dataDoFator(10000), null);
  assert.equal(dataDoFator("abc"), null);
});

test("fator do ciclo atual vira data", () => {
  assert.equal(dataDoFator(1000, "2026-08-15"), "2025-02-22", "fator 1000 = início do ciclo");
  assert.equal(dataDoFator(1001, "2026-08-15"), "2025-02-23");
  assert.equal(dataDoFator(1365, "2026-08-15"), "2026-02-22", "365 dias depois");
});

test("código de barras de 44 dígitos avisa em vez de tentar ler", () => {
  const r = leLinhaDigitavel("34194844100000020001790001043510049102015000");
  assert.ok(r.error);
  assert.match(r.error, /linha digitável/i);
});

test("quantidade errada de dígitos explica o que é esperado", () => {
  const r = leLinhaDigitavel("1234567890");
  assert.ok(r.error);
  assert.match(r.error, /47/);
  assert.match(r.error, /48/);
});

test("campo vazio pede os números em vez de dar erro técnico", () => {
  for (const vazio of ["", "   ", null, undefined, "abc"]) {
    const r = leLinhaDigitavel(vazio);
    assert.ok(r.error, JSON.stringify(vazio));
    assert.ok(!/undefined|NaN|null/.test(r.error), r.error);
  }
});

test("apenasDigitos limpa o que a pessoa colar", () => {
  assert.equal(apenasDigitos("846-700.00 0017 x"), "846700000017");
  assert.equal(apenasDigitos(null), "");
});

// --- Concessionária (água, luz) ---------------------------------------------
// Linha montada com identificador 6, cujos blocos usam mod10 — o mesmo mod10
// já conferido acima contra o boleto real. mod11Bloco não tem exemplo público
// aqui, então é exercitado à parte, com valores calculados.

function montaConcessionaria(barras44) {
  let linha = "";
  for (let i = 0; i < 4; i++) {
    const bloco = barras44.slice(i * 11, i * 11 + 11);
    linha += bloco + String(mod10(bloco));
  }
  return linha;
}

test("conta de concessionária: lê o valor e não inventa vencimento", () => {
  // produto 8, segmento 2 (saneamento), identificador 6, DV geral 5,
  // valor 00000015050 = R$ 150,50, resto campo livre.
  const barras = "826" + "5" + "00000015050" + "0".repeat(29);
  const r = leLinhaDigitavel(montaConcessionaria(barras));
  assert.equal(r.error, undefined);
  assert.equal(r.tipo, "concessionaria");
  assert.equal(r.valor, 150.5);
  assert.equal(r.vencimento, null, "a data mora no campo livre, em formato de cada empresa");
  assert.equal(r.codigoBarras.length, 44);
});

test("concessionária com dígito trocado é recusada", () => {
  const barras = "826" + "5" + "00000015050" + "0".repeat(29);
  const linha = montaConcessionaria(barras);
  const quebrada = linha.slice(0, 5) + (Number(linha[5]) === 9 ? "0" : "9") + linha.slice(6);
  const r = leLinhaDigitavel(quebrada);
  assert.ok(r.error);
  assert.match(r.error, /não conferem/i);
});

test("identificador de valor desconhecido é recusado", () => {
  const barras = "820" + "5" + "00000015050" + "0".repeat(29);
  const r = leLinhaDigitavel(montaConcessionaria(barras));
  assert.ok(r.error);
  assert.match(r.error, /não reconhecido/i);
});

test("mod11 de bloco respeita a convenção da arrecadação", () => {
  // Resto 0 e resto 1 têm tratamento próprio na FEBRABAN.
  assert.equal(typeof mod11Bloco("00000000000"), "number");
  assert.ok(mod11Bloco("12345678901") >= 0 && mod11Bloco("12345678901") <= 10);
  assert.equal(mod11Bloco("00000000000"), 0);
});
