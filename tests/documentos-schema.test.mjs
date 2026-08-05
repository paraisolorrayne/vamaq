/**
 * Contrato do schema dos documentos guardados, contra Postgres real.
 *
 *   1. apagar o veículo NÃO apaga o contrato (vira vehicle_id nulo);
 *   2. apagar o usuário NÃO apaga o contrato (vira criado_por nulo);
 *   3. documento sem veículo é aceito;
 *   4. tipo é restrito aos quatro modelos.
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
const TEST_DB = "vamaq_docs_test";

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
  for (const f of ["schema.sql", "auth-schema.sql", "documentos-schema.sql"]) {
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

async function novoVeiculo(slug) {
  const { rows } = await pool.query(
    `insert into vehicles (slug, brand, model, year, price)
     values ($1,'Audi','Q5',2022,200000) returning id`,
    [slug]
  );
  return rows[0].id;
}

async function novoUsuario(email) {
  const { rows } = await pool.query(
    `insert into users (name, email, password_hash, role)
     values ('Fulano',$1,'x','vendedor') returning id`,
    [email]
  );
  return rows[0].id;
}

async function novoDoc({ vehicleId = null, userId = null, tipo = "venda", arquivo = "2026/a.pdf" }) {
  const { rows } = await pool.query(
    `insert into documentos_gerados (tipo, titulo, cliente, vehicle_id, arquivo, tamanho, criado_por)
     values ($1,'Contrato de Venda','Maria Souza',$2,$3,1234,$4) returning id`,
    [tipo, vehicleId, arquivo, userId]
  );
  return rows[0].id;
}

test("apagar o veículo mantém o contrato, sem o vínculo", async () => {
  const v = await novoVeiculo("q5-doc");
  const d = await novoDoc({ vehicleId: v, arquivo: "2026/b.pdf" });
  await pool.query(`delete from vehicles where id=$1`, [v]);
  const { rows } = await pool.query(`select vehicle_id from documentos_gerados where id=$1`, [d]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].vehicle_id, null);
});

test("apagar o usuário mantém o contrato, sem o autor", async () => {
  const u = await novoUsuario("vendedor@vamaqmotors.com.br");
  const d = await novoDoc({ userId: u, arquivo: "2026/c.pdf" });
  await pool.query(`delete from users where id=$1`, [u]);
  const { rows } = await pool.query(`select criado_por from documentos_gerados where id=$1`, [d]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].criado_por, null);
});

test("documento sem veículo é aceito", async () => {
  const d = await novoDoc({ arquivo: "2026/d.pdf" });
  const { rows } = await pool.query(`select vehicle_id from documentos_gerados where id=$1`, [d]);
  assert.equal(rows[0].vehicle_id, null);
});

test("tipo é restrito aos quatro modelos", async () => {
  for (const t of ["compra-venda", "venda", "consignacao", "termo-vistoria"]) {
    await novoDoc({ tipo: t, arquivo: `2026/${t}.pdf` });
  }
  await assert.rejects(
    () => novoDoc({ tipo: "qualquer-coisa", arquivo: "2026/x.pdf" }),
    /documento_tipo_check/
  );
});
