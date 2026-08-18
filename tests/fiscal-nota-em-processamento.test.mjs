/**
 * O que o sistema responde quando o veículo JÁ tem nota — e por que as duas
 * situações não podem dar a mesma resposta.
 *
 * O QUE ACONTECEU (18/08/2026): a Mayra emitiu a nota do Audi, a emissão
 * seguiu normalmente e a tela respondeu *"já tem uma nota processando (...).
 * Para emitir outra, cancele a nota atual primeiro"*. Ela achou que tinha dado
 * erro. A nota estava a caminho de ser autorizada — e foi.
 *
 * O conselho era impossível de seguir: nota em processamento não tem protocolo
 * de autorização, então não existe o que cancelar. A emissão da NF-e é
 * assíncrona (a Focus responde `processando_autorizacao` e a autorização chega
 * numa consulta depois), e "ainda não voltou" foi tratado como "já existe,
 * desfaça".
 *
 * Os dois casos bloqueiam a emissão pelo mesmo motivo e pedem instruções
 * OPOSTAS: um manda esperar, o outro manda cancelar. É isso que este teste
 * trava.
 *
 * Nenhuma chamada de rede acontece: a guarda roda antes de montar o payload e
 * antes de falar com a Focus.
 *
 *   npm test   (usa TEST_ADMIN_URL, default postgres@localhost)
 */
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
const TEST_DB = "vamaq_nota_processando_test";

let pool;
let notas;
let vehicleId;

before(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const u = new URL(ADMIN_URL);
  const url = `${u.protocol}//${u.username || "postgres"}@${u.hostname}:${u.port || 5432}/${TEST_DB}`;
  pool = new pg.Pool({ connectionString: url });
  for (const f of ["schema.sql", "fiscal-schema.sql", "fiscal-entrada.sql"]) {
    await pool.query(await readFile(path.join(ROOT, "db", f), "utf8"));
  }

  await pool.query(
    `insert into vehicles (slug, brand, model, year, price, status)
     values ('audi-rs4-teste','Audi','RS4',2019,330000,'vendido') returning id`
  );
  vehicleId = (await pool.query(`select id from vehicles limit 1`)).rows[0].id;
  await pool.query(
    `insert into fiscal_config (cnpj, cfop, cst, ncm, serie)
     values ('45348469000154','5102','020','87032100','2')`
  );

  // Token de mentira só para passar por focusEnabled() — a guarda testada
  // devolve antes de qualquer chamada de rede.
  process.env.FOCUS_NFE_TOKEN = "token-de-teste";
  process.env.DATABASE_URL = url;
  notas = await import("@/lib/fiscal/notas");
});

after(async () => {
  const { getPool } = await import("@/lib/db");
  await getPool()?.end();
  await pool?.end();
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.end();
});

async function comNotaNoStatus(status) {
  await pool.query(`delete from notas_fiscais`);
  await pool.query(
    `insert into notas_fiscais (ref, vehicle_id, status, valor, serie)
     values ($1,$2,$3,330000,'2')`,
    [`vamaq-teste-${status}`, vehicleId, status]
  );
  return notas.emitirNotaVeiculo(vehicleId, {
    destinatario: { nome: "Comprador" },
    valorVenda: 330000,
    custoAquisicao: 300000,
  });
}

test("nota PROCESSANDO: manda esperar, e não manda cancelar", async () => {
  const res = await comNotaNoStatus("processando");
  assert.ok(res.error, "deveria bloquear a segunda emissão");
  assert.match(res.error, /autorizada pela SEFAZ|aguarde/i);
  assert.doesNotMatch(
    res.error,
    /cancele/i,
    "não pode mandar cancelar uma nota que ainda não tem protocolo"
  );
  assert.match(res.error, /não emita de novo/i, "precisa dizer o que NÃO fazer");
});

test("nota AUTORIZADA: aí sim manda cancelar antes de emitir outra", async () => {
  const res = await comNotaNoStatus("autorizada");
  assert.ok(res.error);
  assert.match(res.error, /cancele/i);
});

test("nota com ERRO não bloqueia: é justamente o caso de emitir de novo", async () => {
  const res = await comNotaNoStatus("erro");
  // Passa da guarda — para com outra coisa (destinatário incompleto), nunca
  // com "já tem nota".
  assert.ok(!/já tem nota|já foi enviada/i.test(res.error || ""), res.error);
});

test("nota CANCELADA também não bloqueia", async () => {
  const res = await comNotaNoStatus("cancelada");
  assert.ok(!/já tem nota|já foi enviada/i.test(res.error || ""), res.error);
});
