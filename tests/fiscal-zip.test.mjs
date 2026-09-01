/**
 * Contrato do gerador de .zip (src/lib/fiscal/zip.js).
 *
 * O pacote de XMLs que vai para a contabilidade é montado sem dependência
 * nova — só `zlib` — então o que garante que o arquivo é um zip DE VERDADE é
 * este teste: ele escreve o zip em disco e manda o `unzip` do sistema abrir.
 * Zip "quase certo" abre no Mac e quebra no computador do contador.
 *
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { criarZip } from "../src/lib/fiscal/zip.js";

/** Escreve o zip num diretório temporário e devolve o caminho. */
function gravarZip(buffer) {
  const dir = mkdtempSync(path.join(tmpdir(), "vamaq-zip-"));
  const arquivo = path.join(dir, "pacote.zip");
  writeFileSync(arquivo, buffer);
  return { dir, arquivo };
}

test("o unzip do sistema abre o pacote e lê o conteúdo de cada arquivo", () => {
  const zip = criarZip([
    { nome: "saida/NF-23.xml", conteudo: "<nfeProc>venda</nfeProc>" },
    { nome: "entrada/NF-11.xml", conteudo: "<nfeProc>compra</nfeProc>" },
  ]);

  const { dir, arquivo } = gravarZip(zip);
  try {
    const lista = execFileSync("unzip", ["-Z1", arquivo], { encoding: "utf8" });
    assert.deepEqual(lista.trim().split("\n").sort(), [
      "entrada/NF-11.xml",
      "saida/NF-23.xml",
    ]);

    const venda = execFileSync("unzip", ["-p", arquivo, "saida/NF-23.xml"], {
      encoding: "utf8",
    });
    assert.equal(venda, "<nfeProc>venda</nfeProc>");

    const compra = execFileSync("unzip", ["-p", arquivo, "entrada/NF-11.xml"], {
      encoding: "utf8",
    });
    assert.equal(compra, "<nfeProc>compra</nfeProc>");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("o unzip valida o CRC de um XML grande e repetitivo (o que a deflate mais comprime)", () => {
  // XML de NF-e real tem milhares de bytes e muita repetição — é justamente
  // aí que um CRC ou um tamanho escrito errado no cabeçalho aparece.
  const grande = "<det>" + "<prod><cProd>1</cProd></prod>".repeat(500) + "</det>";
  const zip = criarZip([{ nome: "saida/grande.xml", conteudo: grande }]);

  const { dir, arquivo } = gravarZip(zip);
  try {
    // `unzip -t` confere o CRC de cada entrada: é o teste de integridade.
    const saida = execFileSync("unzip", ["-t", arquivo], { encoding: "utf8" });
    assert.match(saida, /No errors detected/);

    const lido = execFileSync("unzip", ["-p", arquivo, "saida/grande.xml"], {
      encoding: "utf8",
    });
    assert.equal(lido, grande);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("acentos no nome do arquivo sobrevivem à ida e volta", () => {
  // O relatório do que faltou tem acento no nome, e nome em UTF-8 dentro de
  // zip só funciona com a flag de idioma ligada no cabeçalho.
  const zip = criarZip([{ nome: "_faltando.txt", conteudo: "nota 23 não veio" }]);

  const { dir, arquivo } = gravarZip(zip);
  try {
    const lido = execFileSync("unzip", ["-p", arquivo, "_faltando.txt"], {
      encoding: "utf8",
    });
    assert.equal(lido, "nota 23 não veio");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("zip sem nenhum arquivo é reconhecido como zip vazio, não como arquivo corrompido", () => {
  // A tela não deixa baixar mês sem nota, mas se deixasse, o que sai daqui
  // precisa ser um zip legível e vazio — nunca um arquivo que o descompactador
  // do contador acusa como danificado.
  const { dir, arquivo } = gravarZip(criarZip([]));
  try {
    let stderr = "";
    try {
      execFileSync("unzip", ["-l", arquivo], { encoding: "utf8" });
    } catch (err) {
      // O unzip sai com código 1 e avisa que está vazio — é assim que ele
      // relata um zip válido sem entradas.
      stderr = err.stderr || "";
    }
    assert.match(stderr, /zipfile is empty/);
    assert.doesNotMatch(stderr, /End-of-central-directory signature not found/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
