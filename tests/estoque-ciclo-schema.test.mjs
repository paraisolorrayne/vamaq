/**
 * Contrato do schema do ciclo de vida do veículo, contra Postgres real.
 *
 *   1. vehicles.ciclo nasce em 1 — é o que torna a mudança retrocompatível;
 *   2. notas_fiscais.ciclo também, para toda nota que já existe;
 *   3. o trigger carimba a nota com o ciclo DO VEÍCULO, não com o default;
 *   4. vehicle_ciclos não aceita o mesmo ciclo duas vezes no mesmo carro;
 *   5. apagar o veículo leva os ciclos junto (cascade).
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
const TEST_DB = "vamaq_ciclo_test";

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
  // A ordem é a de db/aplicar-schemas.sh: fiscal ALTERA vehicles, fiscal-entrada
  // ALTERA notas_fiscais (coluna `operacao`, que o índice do ciclo usa), e o
  // ciclo ALTERA os dois.
  for (const file of [
    "schema.sql",
    "auth-schema.sql",
    "fiscal-schema.sql",
    "fiscal-entrada.sql",
    "estoque-ciclo.sql",
  ]) {
    await pool.query(await readFile(path.join(ROOT, "db", file), "utf8"));
  }
});

after(async () => {
  await pool?.end();
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.end();
});

async function novoVeiculo(slug) {
  const { rows } = await pool.query(
    `insert into vehicles (slug, brand, model, year, price)
     values ($1,'Audi','Q5',2022,200000) returning id, ciclo`,
    [slug]
  );
  return rows[0];
}

test("veículo novo nasce no ciclo 1", async () => {
  const v = await novoVeiculo("q5-ciclo-1");
  assert.equal(v.ciclo, 1);
});

test("aplicar o arquivo duas vezes não dói", async () => {
  const sql = await readFile(path.join(ROOT, "db", "estoque-ciclo.sql"), "utf8");
  await pool.query(sql);
  const { rows } = await pool.query(
    `select column_default from information_schema.columns
      where table_name='vehicles' and column_name='ciclo'`
  );
  assert.equal(rows.length, 1);
});

test("o trigger carimba a nota com o ciclo do veículo", async () => {
  const v = await novoVeiculo("q5-ciclo-trigger");
  await pool.query(`update vehicles set ciclo = 2 where id = $1`, [v.id]);
  await pool.query(
    `insert into notas_fiscais (ref, vehicle_id, status, valor)
     values ('ref-ciclo-2', $1, 'autorizada', 200000)`,
    [v.id]
  );
  const { rows } = await pool.query(
    `select ciclo from notas_fiscais where ref = 'ref-ciclo-2'`
  );
  assert.equal(rows[0].ciclo, 2, "a nota tem que nascer no ciclo corrente do carro");
});

test("nota do carro no ciclo 1 continua no ciclo 1", async () => {
  const v = await novoVeiculo("q5-ciclo-um");
  await pool.query(
    `insert into notas_fiscais (ref, vehicle_id, status, valor)
     values ('ref-ciclo-1', $1, 'autorizada', 200000)`,
    [v.id]
  );
  const { rows } = await pool.query(
    `select ciclo from notas_fiscais where ref = 'ref-ciclo-1'`
  );
  assert.equal(rows[0].ciclo, 1);
});

test("vehicle_ciclos não aceita o mesmo ciclo duas vezes no mesmo carro", async () => {
  const v = await novoVeiculo("q5-ciclo-unico");
  await pool.query(
    `insert into vehicle_ciclos (vehicle_id, ciclo, data_entrada, data_saida, price)
     values ($1, 1, '2026-01-10', '2026-06-20', 200000)`,
    [v.id]
  );
  await assert.rejects(
    () =>
      pool.query(
        `insert into vehicle_ciclos (vehicle_id, ciclo, data_entrada, data_saida, price)
         values ($1, 1, '2026-01-10', '2026-06-20', 200000)`,
        [v.id]
      ),
    /duplicate key|unique/i
  );
});

test("apagar o veículo leva o histórico de ciclos junto", async () => {
  const v = await novoVeiculo("q5-ciclo-cascade");
  await pool.query(
    `insert into vehicle_ciclos (vehicle_id, ciclo, data_entrada, data_saida, price)
     values ($1, 1, '2026-01-10', '2026-06-20', 200000)`,
    [v.id]
  );
  await pool.query(`delete from vehicles where id = $1`, [v.id]);
  const { rows } = await pool.query(
    `select 1 from vehicle_ciclos where vehicle_id = $1`,
    [v.id]
  );
  assert.equal(rows.length, 0);
});
