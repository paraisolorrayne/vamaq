/**
 * "Hoje" no banco tem que ser o de Uberlândia, não o do servidor.
 *
 * A VPS veio do provedor em Europe/Berlin e o Postgres herdou o fuso. Isso não
 * é enfeite: `current_date` grava a data de pagamento de uma conta
 * (markBillPaid), a data de saída do veículo vendido (vehicleStore) e decide
 * quantas contas estão vencidas (getSaudeFinanceira). Em Berlim, a partir das
 * 19h de Uberlândia os três já usavam o DIA SEGUINTE — a Mayra dava baixa numa
 * conta às 19h30 e ela era gravada como paga amanhã.
 *
 * O teste cria um banco com o fuso ERRADO de propósito (o mesmo Europe/Berlin
 * da VPS) e prova que a conexão da aplicação continua respondendo em São Paulo.
 * Fixar o fuso só no servidor passaria neste teste sem a correção — e é
 * justamente o que não protege quando o banco é restaurado noutra máquina.
 *
 *   npm test   (usa TEST_ADMIN_URL, default postgres@localhost)
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { OPCOES_CONEXAO, TIMEZONE_APP } from "../src/lib/pgTypes.js";

const ADMIN_URL =
  process.env.TEST_ADMIN_URL || "postgres://postgres@localhost:5432/postgres";
const TEST_DB = "vamaq_tz_current_date_test";

function urlFor() {
  const u = new URL(ADMIN_URL);
  return `${u.protocol}//${u.username || "postgres"}@${u.hostname}:${u.port || 5432}/${TEST_DB}`;
}

before(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`create database ${TEST_DB}`);
  // O fuso errado, igual ao que a VPS tinha.
  await admin.query(`alter database ${TEST_DB} set timezone = 'Europe/Berlin'`);
  await admin.end();
});

after(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.end();
});

test("o banco de teste está mesmo no fuso errado — senão o teste não prova nada", async () => {
  const p = new pg.Pool({ connectionString: urlFor() });
  const { rows } = await p.query("select current_setting('TimeZone') as tz");
  await p.end();
  assert.equal(rows[0].tz, "Europe/Berlin");
});

test("a conexão da aplicação responde no fuso da loja", async () => {
  const p = new pg.Pool({ connectionString: urlFor(), ...OPCOES_CONEXAO });
  const { rows } = await p.query("select current_setting('TimeZone') as tz");
  await p.end();
  assert.equal(rows[0].tz, TIMEZONE_APP);
});

test("às 19h30 de Uberlândia, current_date ainda é hoje — não amanhã", async () => {
  // 2026-08-18 19:30 em São Paulo (UTC-3) = 2026-08-19 00:30 em Berlim (UTC+2).
  // É a janela em que os dois fusos discordam do dia, e onde o bug aparecia.
  const instante = "2026-08-18 22:30:00+00";

  const errado = new pg.Pool({ connectionString: urlFor() });
  const { rows: r1 } = await errado.query(
    `select ($1::timestamptz)::date::text as dia`, [instante]
  );
  await errado.end();
  assert.equal(r1[0].dia, "2026-08-19", "em Berlim esse instante já é dia 19");

  const certo = new pg.Pool({ connectionString: urlFor(), ...OPCOES_CONEXAO });
  const { rows: r2 } = await certo.query(
    `select ($1::timestamptz)::date::text as dia`, [instante]
  );
  await certo.end();
  assert.equal(r2[0].dia, "2026-08-18", "em Uberlândia ainda é dia 18");
});

test("o instante gravado num timestamptz não muda — só a leitura", async () => {
  const instante = "2026-08-18 22:30:00+00";
  const p = new pg.Pool({ connectionString: urlFor(), ...OPCOES_CONEXAO });
  const { rows } = await p.query(
    `select extract(epoch from $1::timestamptz)::bigint as epoch`, [instante]
  );
  await p.end();
  // 2026-08-18T22:30:00Z — o mesmo número em qualquer fuso.
  assert.equal(Number(rows[0].epoch), Date.parse("2026-08-18T22:30:00Z") / 1000);
});
