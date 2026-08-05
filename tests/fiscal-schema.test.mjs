/**
 * Contrato do schema fiscal contra Postgres real.
 *
 *   1. a ref é única (não dá para reaproveitar identificador de emissão);
 *   2. status aceita só os quatro valores conhecidos;
 *   3. veículo com nota emitida não pode ser apagado (on delete restrict);
 *   4. fiscal_config guarda os parâmetros do contador;
 *   5. vehicles.chassi existe.
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
const TEST_DB = "vamaq_fiscal_test";

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
  for (const file of ["schema.sql", "fiscal-schema.sql"]) {
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
    `insert into vehicles (slug, brand, model, year, price, chassi)
     values ($1,'Audi','Q5',2022,200000,'9BWZZZ377VT004251') returning id`,
    [slug]
  );
  return rows[0].id;
}

async function novaNota(vehicleId, ref, status = "processando") {
  return pool.query(
    `insert into notas_fiscais (ref, vehicle_id, status, valor)
     values ($1,$2,$3,200000)`,
    [ref, vehicleId, status]
  );
}

test("vehicles ganhou a coluna chassi", async () => {
  const id = await novoVeiculo("q5-chassi");
  const { rows } = await pool.query(`select chassi from vehicles where id=$1`, [id]);
  assert.equal(rows[0].chassi, "9BWZZZ377VT004251");
});

test("a ref da emissão é única", async () => {
  const id = await novoVeiculo("q5-ref");
  await novaNota(id, "vamaq-1");
  await assert.rejects(() => novaNota(id, "vamaq-1"), /notas_fiscais_ref_key/);
});

test("status aceita só os quatro valores conhecidos", async () => {
  const id = await novoVeiculo("q5-status");
  for (const s of ["processando", "autorizada", "erro", "cancelada"]) {
    await novaNota(id, `vamaq-status-${s}`, s);
  }
  await assert.rejects(
    () => novaNota(id, "vamaq-status-x", "qualquer"),
    /nota_status_check/
  );
});

test("veículo com nota emitida não pode ser apagado", async () => {
  const id = await novoVeiculo("q5-restrict");
  await novaNota(id, "vamaq-restrict");
  await assert.rejects(
    () => pool.query(`delete from vehicles where id=$1`, [id]),
    /notas_fiscais_vehicle_id_fkey/
  );
});

test("fiscal_config guarda os parâmetros do contador", async () => {
  await pool.query(
    `insert into fiscal_config (cnpj, ie, im, cfop, cst, ncm, serie, icms_seminovo_aliquota)
     values ('45348469000154','00548033300093','73753300','5102','000','87032310','1',5)`
  );
  const { rows } = await pool.query(`select cfop, icms_seminovo_aliquota from fiscal_config`);
  assert.equal(rows[0].cfop, "5102");
  assert.equal(Number(rows[0].icms_seminovo_aliquota), 5);
});

test("fiscal_config é singleton: um segundo insert é rejeitado", async () => {
  // Isola de testes anteriores para não depender da ordem de execução.
  await pool.query(`delete from fiscal_config`);
  await pool.query(
    `insert into fiscal_config (cnpj, cfop, cst, ncm, serie)
     values ('45348469000154','5102','000','87032310','1')`
  );
  await assert.rejects(
    () =>
      pool.query(
        `insert into fiscal_config (cnpj, cfop, cst, ncm, serie)
         values ('45348469000154','5102','000','87032310','2')`
      ),
    /fiscal_config_singleton/
  );
});
