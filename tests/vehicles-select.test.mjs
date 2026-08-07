/**
 * Amarra a coluna ano_modelo às duas listas de SELECT que existem em
 * paralelo no código: SELECT_COLS (src/lib/vehicleStore.js, usada pelo
 * painel admin) e SELECT (src/lib/repositories/vehicles.js, usada pelo
 * site público). anoVeiculo() é pura e não valida nada — se uma dessas
 * listas perder `ano_modelo` numa edição futura, ela simplesmente devolve
 * o ano de fabricação, calado, sem erro e sem log. Este teste é o que
 * quebra nesse cenário.
 *
 * Extrai o texto-fonte das duas consultas por regex (em vez de importar os
 * módulos, que usam o alias "@/" — não resolve em `node --test`) e executa
 * as duas de verdade contra um Postgres descartável, provando o caminho
 * inteiro: a coluna existe no banco (schema.sql) E aparece na resposta.
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
const TEST_DB = "vamaq_vehicles_select_test";

function urlFor(user) {
  const u = new URL(ADMIN_URL);
  return `${u.protocol}//${user}@${u.hostname}:${u.port || 5432}/${TEST_DB}`;
}

let pool;
let SELECT_COLS; // src/lib/vehicleStore.js — lista de colunas (sem "select"/"from")
let SELECT; // src/lib/repositories/vehicles.js — statement completo ("select ... from vehicles")

before(async () => {
  // 1. Extrai as duas consultas do texto-fonte (não importa os módulos: eles
  //    usam "@/", que não resolve em node --test).
  const storeSrc = await readFile(
    path.join(ROOT, "src", "lib", "vehicleStore.js"),
    "utf8"
  );
  const storeMatch = storeSrc.match(/const SELECT_COLS = `([\s\S]*?)`;/);
  assert.ok(storeMatch, "SELECT_COLS não encontrado em src/lib/vehicleStore.js");
  SELECT_COLS = storeMatch[1];
  assert.match(
    SELECT_COLS,
    /\bano_modelo\b/,
    "SELECT_COLS (vehicleStore.js) não menciona ano_modelo"
  );

  const repoSrc = await readFile(
    path.join(ROOT, "src", "lib", "repositories", "vehicles.js"),
    "utf8"
  );
  const repoMatch = repoSrc.match(/const SELECT = `([\s\S]*?)`;/);
  assert.ok(repoMatch, "SELECT não encontrado em src/lib/repositories/vehicles.js");
  SELECT = repoMatch[1];
  assert.match(
    SELECT,
    /\bano_modelo\b/,
    "SELECT (repositories/vehicles.js) não menciona ano_modelo"
  );

  // 2. Banco descartável com o schema real aplicado.
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const su = new URL(ADMIN_URL).username || "postgres";
  pool = new pg.Pool({ connectionString: urlFor(su) });
  // schema.sql cria a tabela vehicles, mas SELECT_COLS (vehicleStore.js)
  // também lista `chassi`, que só existe depois de fiscal-schema.sql — sem
  // ela, a query do painel falharia por coluna inexistente antes mesmo de
  // chegar a checar ano_modelo.
  for (const f of ["schema.sql", "fiscal-schema.sql"]) {
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
  const slug = `veiculo-select-${++slugSeq}`;
  const { rows } = await pool.query(
    `insert into vehicles (slug, brand, model, year, price, ano_modelo)
     values ($1,'Audi','Q5',$2,200000,$3) returning id`,
    [slug, year, ano_modelo ?? null]
  );
  return rows[0].id;
}

test("SELECT_COLS do painel (vehicleStore.js) traz ano_modelo", async () => {
  const id = await novoVeiculo({ year: 2021, ano_modelo: 2022 });
  const { rows } = await pool.query(
    `select ${SELECT_COLS} from vehicles where id = $1`,
    [id]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ano_modelo, 2022);
});

test("SELECT do site (repositories/vehicles.js) traz ano_modelo", async () => {
  const id = await novoVeiculo({ year: 2021, ano_modelo: 2022 });
  const { rows } = await pool.query(`${SELECT} where id = $1`, [id]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ano_modelo, 2022);
});
