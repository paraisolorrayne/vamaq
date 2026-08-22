/**
 * A EMISSÃO da nota de entrada — o que grava no banco, não só o payload.
 *
 * O BUG QUE ESTE ARQUIVO EXISTE PARA IMPEDIR (19/08/2026): a Mayra clicou em
 * emitir a nota de um consignado e levou uma tela branca de erro do servidor.
 * O INSERT listava sete colunas e mandava oito valores — `cfop` tinha entrado
 * no `values` e não na lista de colunas.
 *
 * Nada pegou: o build compila (é string SQL), o lint não vê, e os 14 testes da
 * entrada são PUROS — exercitam `montarPayloadEntrada` e param ali. A função
 * que fala com o banco não tinha teste nenhum. É a mesma lição de sempre neste
 * projeto: o defeito estava na camada que ninguém testou.
 *
 * A rede é substituída, não chamada: `emitirNfe` usa o `fetch` global, então
 * trocá-lo aqui exercita o insert e o caminho de erro sem tocar na Focus.
 *
 *   npm test   (usa TEST_ADMIN_URL, default postgres@localhost)
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./tests/helpers/mock-session-loader.mjs", pathToFileURL("./"));

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADMIN_URL =
  process.env.TEST_ADMIN_URL || "postgres://postgres@localhost:5432/postgres";
const TEST_DB = "vamaq_entrada_emissao_test";

let pool;
let notas;
let vehicleId;
const fetchReal = globalThis.fetch;

const CONSIGNANTE = {
  nome: "João Consignante",
  doc: "529.982.247-25",
  cep: "38411-108",
  logradouro: "Rua Exemplo",
  numero: "10",
  bairro: "Centro",
  municipio: "Uberlândia",
  uf: "MG",
};

before(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const u = new URL(ADMIN_URL);
  const url = `${u.protocol}//${u.username || "postgres"}@${u.hostname}:${u.port || 5432}/${TEST_DB}`;
  pool = new pg.Pool({ connectionString: url });
  for (const f of [
    "schema.sql",
    "fiscal-schema.sql",
    "fiscal-entrada.sql",
    "fiscal-consignacao-devolucao.sql",
    "fiscal-natop-60.sql",
  ]) {
    await pool.query(await readFile(path.join(ROOT, "db", f), "utf8"));
  }

  const v = await pool.query(
    `insert into vehicles (slug, brand, model, year, price, status, chassi, placa)
     values ('cayenne-teste','Porsche','Cayenne',2016,175000,'disponivel',
             'WP1AA2923GKA14408','PAS4I58')
     returning id`
  );
  vehicleId = v.rows[0].id;
  await pool.query(
    `insert into fiscal_config (cnpj, cfop, cst, ncm, serie)
     values ('45348469000154','5102','020','87032100','2')`
  );

  process.env.FOCUS_NFE_TOKEN = "token-de-teste";
  process.env.DATABASE_URL = url;
  notas = await import("@/lib/fiscal/notas");
});

after(async () => {
  globalThis.fetch = fetchReal;
  const { getPool } = await import("@/lib/db");
  await getPool()?.end();
  await pool?.end();
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.end();
});

beforeEach(async () => {
  await pool.query(`delete from notas_fiscais`);
  // A Focus responde recusando. O que interessa aqui é o que acontece ANTES e
  // DEPOIS dela — o insert e o registro do erro —, não a integração em si.
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ mensagem: "Focus indisponível no teste" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
});

async function linhaDaNota() {
  const { rows } = await pool.query(
    `select operacao, cfop, status, valor, destinatario, serie from notas_fiscais`
  );
  return rows;
}

test("entrada de COMPRA grava a nota com o CFOP 1102", async () => {
  const res = await notas.emitirNotaEntradaVeiculo(vehicleId, {
    remetente: CONSIGNANTE,
    valorAquisicao: 160000,
    consignacao: false,
  });
  // O insert é o que quebrava. Se ele falhar, isto estoura antes de qualquer
  // asserção — que é exatamente o que a Mayra viu como tela branca.
  const rows = await linhaDaNota();
  assert.equal(rows.length, 1, "a nota tinha que ter sido gravada");
  assert.equal(rows[0].operacao, "entrada");
  assert.equal(rows[0].cfop, "1102");
  assert.equal(Number(rows[0].valor), 160000);
  assert.equal(rows[0].serie, "2");
  // A Focus recusou (stub): a nota fica como erro, não como processando órfã.
  assert.equal(rows[0].status, "erro");
  assert.ok(res.error, "o erro da Focus tem que chegar em quem chamou");
});

test("entrada de CONSIGNAÇÃO grava com o CFOP 1917 — o caso que quebrou", async () => {
  await notas.emitirNotaEntradaVeiculo(vehicleId, {
    remetente: CONSIGNANTE,
    valorAquisicao: 160000,
    consignacao: true,
  });
  const rows = await linhaDaNota();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].cfop, "1917");
  assert.equal(rows[0].operacao, "entrada");
});

test("quem deixou o carro fica gravado na nota, para a devolução reusar", async () => {
  await notas.emitirNotaEntradaVeiculo(vehicleId, {
    remetente: CONSIGNANTE,
    valorAquisicao: 160000,
    consignacao: true,
  });
  const rows = await linhaDaNota();
  assert.equal(rows[0].destinatario.nome, "João Consignante");
  assert.equal(rows[0].destinatario.cep, "38411-108");
});

test("a DEVOLUÇÃO também grava — mesmo insert, mesmo risco", async () => {
  await pool.query(
    `insert into notas_fiscais (ref, vehicle_id, status, valor, destinatario, serie, operacao, cfop)
     values ('vamaq-ent-x',$1,'autorizada',160000,$2::jsonb,'2','entrada','1917')`,
    [vehicleId, JSON.stringify(CONSIGNANTE)]
  );
  await notas.devolverConsignacaoVeiculo(vehicleId);

  const { rows } = await pool.query(
    `select cfop, valor, destinatario from notas_fiscais where operacao='devolucao'`
  );
  assert.equal(rows.length, 1, "a devolução tinha que ter sido gravada");
  assert.equal(rows[0].cfop, "5918");
  // Valor e pessoa saem da entrada, sem redigitar.
  assert.equal(Number(rows[0].valor), 160000);
  assert.equal(rows[0].destinatario.nome, "João Consignante");
});

test("devolver carro que não entrou em consignação é recusado antes de gravar", async () => {
  const res = await notas.devolverConsignacaoVeiculo(vehicleId);
  assert.match(res.error, /consignação/i);
  assert.equal((await linhaDaNota()).length, 0, "não pode gravar nota nenhuma");
});

// A conferência de aritmética dos INSERTs cobre o projeto inteiro e vive em
// tests/sql-insert-aridade.test.mjs — aqui ficam só os testes desta emissão.
