/**
 * Recorte do mês no pacote de XMLs, contra Postgres real.
 *
 * O QUE ESTÁ EM JOGO: `notas_fiscais.created_at` é `timestamptz`, o servidor
 * roda em Europe/Berlin e a loja vive em São Paulo. Nota emitida dia 31 às 21h
 * de São Paulo já é dia 1º em Berlim — sem o fuso certo no recorte, ela some
 * do pacote de agosto e aparece no de setembro. O contador só descobre isso na
 * apuração, e a explicação sobra para a loja.
 *
 * A conexão da aplicação sobe com `-c timezone=America/Sao_Paulo`
 * (src/lib/pgTypes.js); este teste conecta do mesmo jeito.
 *
 *   npm test   (usa TEST_ADMIN_URL, default postgres@localhost)
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { SQL_NOTAS_DO_MES } from "../src/lib/fiscal/pacote.js";
import { OPCOES_CONEXAO } from "../src/lib/pgTypes.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADMIN_URL =
  process.env.TEST_ADMIN_URL || "postgres://postgres@localhost:5432/postgres";
const TEST_DB = "vamaq_notas_mes_test";

let pool;
let veiculo;

before(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const u = new URL(ADMIN_URL);
  pool = new pg.Pool({
    connectionString: `${u.protocol}//${u.username || "postgres"}@${u.hostname}:${u.port || 5432}/${TEST_DB}`,
    // O MESMO fuso da aplicação. Sem isto o teste passaria por acaso na
    // máquina de quem roda em São Paulo e falharia no servidor.
    ...OPCOES_CONEXAO,
  });
  for (const file of ["schema.sql", "fiscal-schema.sql", "fiscal-entrada.sql"]) {
    await pool.query(await readFile(path.join(ROOT, "db", file), "utf8"));
  }

  const { rows } = await pool.query(
    `insert into vehicles (slug, brand, model, year, price)
     values ('gol-teste','VW','Gol',2022,50000) returning id`
  );
  veiculo = rows[0].id;
});

after(async () => {
  await pool?.end();
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.end();
});

async function nota({ ref, numero, operacao = "saida", emitidaEm, xml = "http://x/a.xml", status = "autorizada" }) {
  await pool.query(
    `insert into notas_fiscais (ref, vehicle_id, status, numero, operacao, xml_url, created_at)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [ref, veiculo, status, numero, operacao, xml, emitidaEm]
  );
}

async function doMes(ano, mes) {
  const { rows } = await pool.query(SQL_NOTAS_DO_MES, [ano, mes]);
  return rows.map((r) => r.numero);
}

test("nota emitida no fim da noite do último dia do mês fica NESSE mês", async () => {
  // 31/08/2026 23:30 em São Paulo — que em UTC já é 01/09.
  await nota({ ref: "fim-de-agosto", numero: "23", emitidaEm: "2026-08-31T23:30:00-03:00" });
  // 01/09/2026 00:30 em São Paulo — setembro, não agosto.
  await nota({ ref: "inicio-de-setembro", numero: "24", emitidaEm: "2026-09-01T00:30:00-03:00" });

  assert.deepEqual(await doMes(2026, 8), ["23"]);
  assert.deepEqual(await doMes(2026, 9), ["24"]);
});

test("nota de entrada entra no pacote junto com a de saída", async () => {
  await nota({
    ref: "compra-de-agosto",
    numero: "11",
    operacao: "entrada",
    emitidaEm: "2026-08-10T10:00:00-03:00",
  });
  const numeros = await doMes(2026, 8);
  assert.ok(numeros.includes("11"), `esperava a entrada 11 no pacote, veio ${numeros}`);
});

test("nota cancelada entra no pacote — é ela que explica o buraco na numeração", async () => {
  await nota({
    ref: "cancelada-de-agosto",
    numero: "25",
    status: "cancelada",
    emitidaEm: "2026-08-12T10:00:00-03:00",
  });
  assert.ok((await doMes(2026, 8)).includes("25"));
});

test("nota sem XML fica de fora — não existe arquivo para mandar", async () => {
  await nota({
    ref: "com-erro",
    numero: "26",
    status: "erro",
    xml: null,
    emitidaEm: "2026-08-13T10:00:00-03:00",
  });
  assert.ok(!(await doMes(2026, 8)).includes("26"));
});
