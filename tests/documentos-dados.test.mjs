/**
 * Os campos digitados do contrato: guardados para corrigir, sem vazar na lista.
 *
 * O PEDIDO (Mateus/Mayra, 18/08/2026): poder corrigir um contrato já gerado.
 * Ela teve que refazer uma minuta inteira porque a informação da chave reserva
 * estava errada — o PDF era guardado, o que ela digitou não.
 *
 * O RISCO QUE VEM JUNTO: esses campos são CPF, CNH e endereço das partes. A
 * listagem de documentos vai inteira para o navegador de quem abre a tela, com
 * dezenas de contratos. Se `dados` entrar nela, os documentos pessoais de todos
 * os clientes passam a trafegar a cada abertura da página, sem que ninguém
 * tenha pedido. O teste central aqui é justamente esse: a lista NÃO leva os
 * campos; quem corrige busca um contrato de cada vez.
 *
 *   npm test   (usa TEST_ADMIN_URL, default postgres@localhost)
 */
// Resolve o alias "@/" para src/ — mesmo hook dos testes de autorização.
// Ver tests/helpers/mock-session-loader.mjs.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./tests/helpers/mock-session-loader.mjs", pathToFileURL("./"));

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADMIN_URL =
  process.env.TEST_ADMIN_URL || "postgres://postgres@localhost:5432/postgres";
const TEST_DB = "vamaq_doc_dados_test";

function urlFor(user) {
  const u = new URL(ADMIN_URL);
  return `${u.protocol}//${user}@${u.hostname}:${u.port || 5432}/${TEST_DB}`;
}

let pool;
let lib;

const CPF_SECRETO = "529.982.247-25";

before(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const su = new URL(ADMIN_URL).username || "postgres";
  const url = urlFor(su);
  pool = new pg.Pool({ connectionString: url });
  for (const f of [
    "schema.sql",
    "auth-schema.sql",
    "documentos-schema.sql",
    "fiscal-schema.sql",
    "clientes-schema.sql",
    "assinatura-schema.sql",
    "documentos-dados.sql",
  ]) {
    await pool.query(await readFile(path.join(ROOT, "db", f), "utf8"));
  }

  // O módulo real usa DATABASE_URL — apontamos para o banco de teste ANTES de
  // importar, para exercitar listDocumentos() de verdade e não uma cópia.
  process.env.DATABASE_URL = url;
  lib = await import("@/lib/documentos");
});

after(async () => {
  // O pool do módulo real (src/lib/db.js) é de nível de módulo e não fecha
  // sozinho — sem isto o `node --test` fica pendurado depois do último teste.
  const { getPool } = await import("@/lib/db");
  await getPool()?.end();
  await pool?.end();
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.end();
});

async function gravarContrato({ dados, corrigeDocumentoId } = {}) {
  const res = await lib.salvarDocumento({
    tipo: "venda",
    titulo: "Contrato de Venda",
    cliente: "Maria Souza",
    buffer: Buffer.from("%PDF-1.4 fake"),
    dados,
    corrigeDocumentoId,
  });
  assert.equal(res.error, undefined, res.error);
  return res.documento;
}

test("os campos digitados voltam inteiros para quem vai corrigir", async () => {
  const doc = await gravarContrato({
    dados: { comprador_nome: "Maria Souza", comprador_cpf: CPF_SECRETO, chave_reserva: "não" },
  });
  const lido = await lib.getDocumentoDados(doc.id);
  assert.equal(lido.dados.comprador_cpf, CPF_SECRETO);
  assert.equal(lido.dados.chave_reserva, "não");
  assert.equal(lido.tipo, "venda");
});

test("a LISTAGEM não leva os campos pessoais — nem o CPF, nem a chave `dados`", async () => {
  await gravarContrato({ dados: { comprador_cpf: CPF_SECRETO } });
  const lista = await lib.listDocumentos();
  assert.ok(lista.length > 0, "deveria haver documentos na lista");

  for (const linha of lista) {
    assert.equal(linha.dados, undefined, "`dados` não pode vir na listagem");
  }
  // A prova que não depende do nome da coluna: o CPF não pode aparecer em
  // lugar nenhum do que a lista devolve.
  assert.ok(
    !JSON.stringify(lista).includes("529.982.247-25"),
    "o CPF vazou na listagem de documentos"
  );
});

test("a lista diz se dá para corrigir, sem carregar nada de pessoal", async () => {
  const comDados = await gravarContrato({ dados: { comprador_cpf: CPF_SECRETO } });
  const semDados = await gravarContrato();
  const lista = await lib.listDocumentos();
  const acha = (id) => lista.find((l) => l.id === id);
  assert.equal(acha(comDados.id).tem_dados, true);
  assert.equal(acha(semDados.id).tem_dados, false);
});

test("contrato antigo, sem campos guardados, não é corrigível", async () => {
  const doc = await gravarContrato();
  assert.equal(await lib.getDocumentoDados(doc.id), null);
});

test("a correção aponta para o original, e os dois continuam existindo", async () => {
  const original = await gravarContrato({ dados: { chave_reserva: "não" } });
  const correcao = await gravarContrato({
    dados: { chave_reserva: "sim" },
    corrigeDocumentoId: original.id,
  });
  assert.equal(correcao.corrige_documento_id, original.id);

  const lista = await lib.listDocumentos();
  assert.ok(lista.find((l) => l.id === original.id), "o original tem que continuar na lista");
  assert.ok(lista.find((l) => l.id === correcao.id));
});

test("apagar o original não apaga a correção — ela é o contrato que vale", async () => {
  const original = await gravarContrato({ dados: { chave_reserva: "não" } });
  const correcao = await gravarContrato({
    dados: { chave_reserva: "sim" },
    corrigeDocumentoId: original.id,
  });
  await pool.query(`delete from documentos_gerados where id=$1`, [original.id]);
  const { rows } = await pool.query(
    `select id, corrige_documento_id from documentos_gerados where id=$1`,
    [correcao.id]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].corrige_documento_id, null);
});
