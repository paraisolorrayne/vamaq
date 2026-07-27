/**
 * Teste da blindagem do estoque (PR-C do ADR-002) — o primeiro teste do repo.
 *
 * Prova, contra um Postgres real, o contrato que o site depende:
 *   1. a coluna `status` só aceita valores válidos (CHECK);
 *   2. a view fin.v_vehicles enxerga o estoque;
 *   3. a role do financeiro (vamaq_fin) LÊ public.vehicles e fin.v_vehicles,
 *      mas NÃO consegue inserir/atualizar/apagar veículos — a fonte única fica
 *      protegida no banco, não só por disciplina de código.
 *
 * Precisa de um Postgres local com superusuário. Rodar:
 *   npm test
 *   TEST_ADMIN_URL=postgres://postgres@localhost:5432/postgres npm test
 *
 * Cria um banco descartável (vamaq_blindagem_test) e a role vamaq_fin, e limpa
 * tudo no fim.
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
const TEST_DB = "vamaq_blindagem_test";
const FIN_PW = "fin_test_pw_123";

function dbUrl(user, pw) {
  const u = new URL(ADMIN_URL);
  const base = `${u.protocol}//${user}${pw ? ":" + pw : ""}@${u.hostname}:${u.port || 5432}`;
  return `${base}/${TEST_DB}`;
}

let appPool; // conexão do app (dono, escreve)
let finPool; // conexão do financeiro (só leitura)

before(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  // ambiente limpo
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`drop role if exists vamaq_fin`);
  await admin.query(`create role vamaq_fin login password '${FIN_PW}'`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  // aplica o schema do estoque e a blindagem no banco de teste (como superusuário)
  const setup = new pg.Client({ connectionString: dbUrl(new URL(ADMIN_URL).username || "postgres") });
  await setup.connect();
  await setup.query(await readFile(path.join(ROOT, "db", "schema.sql"), "utf8"));
  await setup.query(await readFile(path.join(ROOT, "db", "fin-blindagem.sql"), "utf8"));
  // um veículo de exemplo
  await setup.query(
    `insert into vehicles (slug, brand, model, year) values ('teste-blindagem','Audi','Q5',2022)`
  );
  await setup.end();

  appPool = new pg.Pool({ connectionString: dbUrl(new URL(ADMIN_URL).username || "postgres") });
  finPool = new pg.Pool({ connectionString: dbUrl("vamaq_fin", FIN_PW) });
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

test("status só aceita valores válidos (CHECK)", async () => {
  await assert.rejects(
    appPool.query(
      `insert into vehicles (slug, brand, model, year, status)
       values ('status-invalido','X','Y',2020,'qualquer')`
    ),
    /status_valido|check/i
  );
  // um status válido passa
  await appPool.query(
    `insert into vehicles (slug, brand, model, year, status)
     values ('status-ok','X','Y',2020,'reservado')`
  );
});

test("fin.v_vehicles enxerga o estoque", async () => {
  const { rows } = await finPool.query(
    `select brand, model from fin.v_vehicles where slug = 'teste-blindagem'`
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].brand, "Audi");
});

test("financeiro LÊ public.vehicles", async () => {
  const { rows } = await finPool.query(`select count(*)::int as n from public.vehicles`);
  assert.ok(rows[0].n >= 1);
});

test("financeiro NÃO insere veículo (blindagem)", async () => {
  await assert.rejects(
    finPool.query(
      `insert into vehicles (slug, brand, model, year) values ('hack','H','H',2020)`
    ),
    /permission denied/i
  );
});

test("financeiro NÃO atualiza veículo (blindagem)", async () => {
  await assert.rejects(
    finPool.query(`update vehicles set price = 1 where slug = 'teste-blindagem'`),
    /permission denied/i
  );
});

test("financeiro NÃO apaga veículo (blindagem)", async () => {
  await assert.rejects(
    finPool.query(`delete from vehicles where slug = 'teste-blindagem'`),
    /permission denied/i
  );
});
