/**
 * Contrato da coluna ano_modelo (e da constraint ano_modelo_check) contra
 * Postgres real.
 *
 *   1. ano_modelo nulo é aceito — veículo sem a coluna preenchida continua
 *      se comportando como antes dela existir;
 *   2. ano_modelo igual ao de fabricação é aceito (não repete na exibição,
 *      mas no banco é um valor válido);
 *   3. ano_modelo um ano à frente do de fabricação é aceito;
 *   4. ano_modelo anterior ao de fabricação é recusado;
 *   5. ano_modelo fora da faixa (1950–2036) é recusado.
 *
 *   npm test   (usa TEST_ADMIN_URL, default postgres@localhost)
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADMIN_URL =
  process.env.TEST_ADMIN_URL || "postgres://postgres@localhost:5432/postgres";
const TEST_DB = "vamaq_ano_modelo_test";

function urlFor(user) {
  const u = new URL(ADMIN_URL);
  return `${u.protocol}//${user}@${u.hostname}:${u.port || 5432}/${TEST_DB}`;
}

let pool;

before(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const su = new URL(ADMIN_URL).username || "postgres";
  pool = new pg.Pool({ connectionString: urlFor(su) });
  for (const f of ["schema.sql"]) {
    await pool.query(await readFile(path.join(ROOT, "db", f), "utf8"));
  }
});

after(async () => {
  await pool?.end();
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.end();
});

let slugSeq = 0;

async function novoVeiculo({ year, ano_modelo }) {
  const slug = `veiculo-ano-modelo-${++slugSeq}`;
  const { rows } = await pool.query(
    `insert into vehicles (slug, brand, model, year, price, ano_modelo)
     values ($1,'Audi','Q5',$2,200000,$3) returning id`,
    [slug, year, ano_modelo ?? null]
  );
  return rows[0].id;
}

test("ano_modelo nulo é aceito", async () => {
  const id = await novoVeiculo({ year: 2021 });
  const { rows } = await pool.query(`select ano_modelo from vehicles where id = $1`, [id]);
  assert.equal(rows[0].ano_modelo, null);
});

test("ano_modelo igual ao de fabricação é aceito", async () => {
  const id = await novoVeiculo({ year: 2022, ano_modelo: 2022 });
  const { rows } = await pool.query(`select ano_modelo from vehicles where id = $1`, [id]);
  assert.equal(rows[0].ano_modelo, 2022);
});

test("ano_modelo um ano à frente é aceito", async () => {
  const id = await novoVeiculo({ year: 2021, ano_modelo: 2022 });
  const { rows } = await pool.query(`select ano_modelo from vehicles where id = $1`, [id]);
  assert.equal(rows[0].ano_modelo, 2022);
});

test("ano_modelo anterior ao de fabricação é recusado", async () => {
  await assert.rejects(() => novoVeiculo({ year: 2022, ano_modelo: 2021 }), /ano_modelo_check/);
});

test("ano_modelo fora da faixa é recusado", async () => {
  await assert.rejects(() => novoVeiculo({ year: 2021, ano_modelo: 2100 }), /ano_modelo_check/);
});
