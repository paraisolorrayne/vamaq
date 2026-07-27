/**
 * Teste do núcleo financeiro (PR-1 do ADR-002) contra Postgres real.
 *
 * Prova o contrato que sustenta o módulo:
 *   1. a role vamaq_fin cria/escreve em fin.* (é dona do schema fin);
 *   2. lança uma transação ligada a um veículo do estoque;
 *   3. NÃO consegue escrever em public.vehicles (blindagem), mas lê;
 *   4. a view fin.v_vehicle_margin calcula receita − custo por veículo;
 *   5. o seed traz a Vamaq + plano de contas de concessionária.
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
const TEST_DB = "vamaq_fin_test";
const FIN_PW = "fin_test_pw_456";

function urlFor(user, pw) {
  const u = new URL(ADMIN_URL);
  return `${u.protocol}//${user}${pw ? ":" + pw : ""}@${u.hostname}:${u.port || 5432}/${TEST_DB}`;
}

let appPool; // vamaq (dona do estoque)
let finPool; // vamaq_fin (financeiro)

before(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`drop role if exists vamaq_fin`);
  await admin.query(`create role vamaq_fin login password '${FIN_PW}'`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const su = new URL(ADMIN_URL).username || "postgres";
  // estoque + blindagem, como superusuário
  const setup = new pg.Client({ connectionString: urlFor(su) });
  await setup.connect();
  await setup.query(await readFile(path.join(ROOT, "db", "schema.sql"), "utf8"));
  await setup.query(await readFile(path.join(ROOT, "db", "fin-blindagem.sql"), "utf8"));
  await setup.query(
    `insert into vehicles (slug, brand, model, year, price) values ('q5-fin','Audi','Q5',2022,200000)`
  );
  await setup.end();

  appPool = new pg.Pool({ connectionString: urlFor(su) });
  finPool = new pg.Pool({ connectionString: urlFor("vamaq_fin", FIN_PW) });

  // schema fin aplicado PELA PRÓPRIA role do financeiro (ela é dona de fin)
  await finPool.query(await readFile(path.join(ROOT, "db", "fin-schema.sql"), "utf8"));
});

after(async () => {
  if (appPool) await appPool.end();
  if (finPool) await finPool.end();
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`drop role if exists vamaq_fin`);
  await admin.end();
});

test("seed: empresa Vamaq + plano de contas de concessionária", async () => {
  const c = await finPool.query(`select name, cnpj from fin.companies`);
  assert.equal(c.rows.length, 1);
  assert.equal(c.rows[0].name, "Vamaq Motors");
  const coa = await finPool.query(`select count(*)::int n from fin.chart_of_accounts`);
  assert.ok(coa.rows[0].n >= 15);
  // 4.1 é o Custo de Aquisição de Veículos (regra do DRE: code 4x = CMV)
  const cmv = await finPool.query(
    `select name from fin.chart_of_accounts where code = '4.1'`
  );
  assert.match(cmv.rows[0].name, /Aquisição/);
});

test("financeiro lança transação ligada a um veículo", async () => {
  const company = (await finPool.query(`select id from fin.companies limit 1`)).rows[0].id;
  const acc = (await finPool.query(`select id from fin.chart_of_accounts where code='4.1'`)).rows[0].id;
  const veh = (await finPool.query(`select id from public.vehicles where slug='q5-fin'`)).rows[0].id;
  await finPool.query(
    `insert into fin.transactions (company_id, date, description, amount, type, account_id, vehicle_id)
     values ($1, current_date, 'Compra do Q5', 150000, 'expense', $2, $3)`,
    [company, acc, veh]
  );
  await finPool.query(
    `insert into fin.transactions (company_id, date, description, amount, type, vehicle_id)
     values ($1, current_date, 'Venda do Q5', 200000, 'revenue', $2)`,
    [company, veh]
  );
  const n = await finPool.query(`select count(*)::int n from fin.transactions`);
  assert.equal(n.rows[0].n, 2);
});

test("view de margem: receita − custo por veículo", async () => {
  const m = await finPool.query(
    `select receita, custo_total, resultado from fin.v_vehicle_margin where model = 'Q5'`
  );
  assert.equal(Number(m.rows[0].receita), 200000);
  assert.equal(Number(m.rows[0].custo_total), 150000);
  assert.equal(Number(m.rows[0].resultado), 50000);
});

test("blindagem: financeiro NÃO escreve em public.vehicles", async () => {
  await assert.rejects(
    finPool.query(`update public.vehicles set price = 1 where slug = 'q5-fin'`),
    /permission denied/i
  );
  await assert.rejects(
    finPool.query(`insert into public.vehicles (slug,brand,model,year) values ('x','x','x',2020)`),
    /permission denied/i
  );
});

test("blindagem: veículo com lançamento não pode ser apagado (RESTRICT)", async () => {
  await assert.rejects(
    appPool.query(`delete from public.vehicles where slug = 'q5-fin'`),
    /violates foreign key|foreign key constraint/i
  );
});
