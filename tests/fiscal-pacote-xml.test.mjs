/**
 * Nomes e organização do pacote de XMLs que vai para a contabilidade
 * (src/lib/fiscal/pacote.js).
 *
 * O contador recebe um .zip e precisa achar cada nota sem abrir arquivo por
 * arquivo: compra separada de venda, número visível, chave no nome (é por ela
 * que o sistema contábil importa) e a cancelada avisando que é cancelada.
 *
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  nomeDoArquivo,
  nomeDoZip,
  relatorioDeFaltando,
} from "../src/lib/fiscal/pacote.js";

const CHAVE = "31260845348469000154550020000000231421849151";

test("nota de saída vai para a pasta saida com número e chave no nome", () => {
  const nome = nomeDoArquivo({
    operacao: "saida",
    numero: "23",
    chave: CHAVE,
    status: "autorizada",
    ref: "abc",
  });
  assert.equal(nome, `saida/NF-23-${CHAVE}.xml`);
});

test("nota de entrada vai para a pasta entrada — é a compra, não a venda", () => {
  const nome = nomeDoArquivo({
    operacao: "entrada",
    numero: "11",
    chave: CHAVE,
    status: "autorizada",
    ref: "abc",
  });
  assert.equal(nome, `entrada/NF-11-${CHAVE}.xml`);
});

test("devolução de consignação tem pasta própria", () => {
  const nome = nomeDoArquivo({
    operacao: "devolucao",
    numero: "7",
    chave: CHAVE,
    status: "autorizada",
    ref: "abc",
  });
  assert.equal(nome, `devolucao/NF-7-${CHAVE}.xml`);
});

test("nota cancelada é marcada no nome — o contador precisa dela para justificar o pulo de numeração", () => {
  const nome = nomeDoArquivo({
    operacao: "saida",
    numero: "23",
    chave: CHAVE,
    status: "cancelada",
    ref: "abc",
  });
  assert.equal(nome, `saida/NF-23-${CHAVE}-CANCELADA.xml`);
});

test("sem chave, o nome cai na ref em vez de virar 'NF-23-null'", () => {
  const nome = nomeDoArquivo({
    operacao: "saida",
    numero: "23",
    chave: null,
    status: "autorizada",
    ref: "9f8e7d6c",
  });
  assert.equal(nome, "saida/NF-23-9f8e7d6c.xml");
});

test("sem número e sem chave o arquivo ainda tem nome único, pela ref", () => {
  const nome = nomeDoArquivo({
    operacao: "saida",
    numero: null,
    chave: null,
    status: "processando",
    ref: "9f8e7d6c",
  });
  assert.equal(nome, "saida/NF-sem-numero-9f8e7d6c.xml");
});

test("operação desconhecida não vira pasta com nome estranho", () => {
  // Defesa contra dado torto no banco: nada de barra ou ponto-ponto vindos do
  // valor da coluna virarem caminho dentro do zip.
  const nome = nomeDoArquivo({
    operacao: "../etc",
    numero: "1",
    chave: CHAVE,
    status: "autorizada",
    ref: "abc",
  });
  assert.equal(nome, `outras/NF-1-${CHAVE}.xml`);
});

test("o zip tem mês e ano no nome, com zero à esquerda", () => {
  assert.equal(nomeDoZip(2026, 8), "xmls-vamaq-2026-08.zip");
  assert.equal(nomeDoZip(2026, 12), "xmls-vamaq-2026-12.zip");
});

test("o relatório do que faltou nomeia cada nota e o motivo", () => {
  const texto = relatorioDeFaltando([
    { numero: "23", operacao: "saida", motivo: "HTTP 404" },
    { numero: null, operacao: "entrada", motivo: "tempo esgotado" },
  ]);
  assert.match(texto, /2 nota/);
  assert.match(texto, /NF 23 \(saida\): HTTP 404/);
  assert.match(texto, /NF sem número \(entrada\): tempo esgotado/);
});

test("sem falha nenhuma, não há relatório para incluir no zip", () => {
  assert.equal(relatorioDeFaltando([]), null);
});
