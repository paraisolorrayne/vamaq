/**
 * Contrato do vínculo entre o CRM (oportunidades) e o cadastro de clientes,
 * contra Postgres real.
 *
 *   1. oportunidades.cliente_id é opcional — oportunidade sem cliente vinculado
 *      continua sendo aceita normalmente;
 *   2. apagar o cliente NÃO apaga a oportunidade: ela é o histórico da
 *      negociação, então o vínculo só cai para null (`on delete set null`);
 *   3. cliente_veiculos aceita origem = 'crm' (a venda feita pelo funil);
 *   4. cliente_veiculos continua recusando uma origem inventada.
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
const TEST_DB = "vamaq_crm_cliente_test";

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
  // Ordem obrigatória: clientes-schema.sql altera documentos_gerados e
  // notas_fiscais (por isso documentos-schema.sql e fiscal-schema.sql vêm
  // antes — mesma ordem de tests/clientes-schema.test.mjs), e crm-schema.sql
  // referencia clientes(id), então clientes-schema.sql precisa ter rodado
  // antes dele.
  for (const f of ["schema.sql", "auth-schema.sql", "documentos-schema.sql", "fiscal-schema.sql", "clientes-schema.sql", "crm-schema.sql"]) {
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

async function novoCliente(nome) {
  const { rows } = await pool.query(
    `insert into clientes (nome) values ($1) returning id`,
    [nome]
  );
  return rows[0].id;
}

async function novoVeiculo(slug) {
  const { rows } = await pool.query(
    `insert into vehicles (slug, brand, model, year, price)
     values ($1,'Audi','Q5',2022,200000) returning id`,
    [slug]
  );
  return rows[0].id;
}

async function novaOportunidade({ clienteId = null, vehicleId = null } = {}) {
  const { rows } = await pool.query(
    `insert into oportunidades (cliente_nome, cliente_id, vehicle_id)
     values ('Lead Qualquer', $1, $2) returning id`,
    [clienteId, vehicleId]
  );
  return rows[0].id;
}

async function ligar(clienteId, vehicleId, papel, origem) {
  const { rows } = await pool.query(
    `insert into cliente_veiculos (cliente_id, vehicle_id, papel, origem) values ($1,$2,$3,$4) returning id`,
    [clienteId, vehicleId, papel, origem]
  );
  return rows[0].id;
}

test("oportunidade com cliente_id nulo é aceita", async () => {
  const id = await novaOportunidade();
  const { rows } = await pool.query(`select cliente_id from oportunidades where id = $1`, [id]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].cliente_id, null);
});

test("apagar o cliente deixa a oportunidade viva, com cliente_id nulo", async () => {
  const clienteId = await novoCliente("Cliente Do Funil");
  const oportunidadeId = await novaOportunidade({ clienteId });

  await pool.query(`delete from clientes where id = $1`, [clienteId]);

  const { rows } = await pool.query(
    `select cliente_id from oportunidades where id = $1`,
    [oportunidadeId]
  );
  assert.equal(rows.length, 1, "a oportunidade não pode ser apagada junto com o cliente");
  assert.equal(rows[0].cliente_id, null);
});

test("cliente_veiculos aceita origem = 'crm'", async () => {
  const clienteId = await novoCliente("Cliente Comprou Pelo CRM");
  const vehicleId = await novoVeiculo("crm-vinculo-cliente");
  const vinculoId = await ligar(clienteId, vehicleId, "comprou", "crm");
  const { rows } = await pool.query(`select origem from cliente_veiculos where id = $1`, [vinculoId]);
  assert.equal(rows[0].origem, "crm");
});

test("cliente_veiculos aceita origem = 'estoque'", async () => {
  // Venda de balcão marcada direto no Estoque (ver
  // docs/superpowers/specs/2026-08-10-marcar-vendido-design.md) — mesma
  // constraint alterada em db/clientes-schema.sql para 'crm', pelo mesmo
  // motivo e nos mesmos dois lugares (create table + bloco `do $$`).
  const clienteId = await novoCliente("Cliente Comprou No Balcão");
  const vehicleId = await novoVeiculo("estoque-vinculo-cliente");
  const vinculoId = await ligar(clienteId, vehicleId, "comprou", "estoque");
  const { rows } = await pool.query(`select origem from cliente_veiculos where id = $1`, [vinculoId]);
  assert.equal(rows[0].origem, "estoque");
});

test("cliente_veiculos continua recusando uma origem inventada", async () => {
  const clienteId = await novoCliente("Cliente Origem Invalida");
  const vehicleId = await novoVeiculo("crm-origem-invalida");
  await assert.rejects(
    () => ligar(clienteId, vehicleId, "comprou", "sei-la"),
    /cliente_veiculo_origem_check/
  );
});
