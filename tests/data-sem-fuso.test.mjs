/**
 * Coluna `date` não pode andar um dia por causa do fuso do servidor.
 *
 * O BUG REAL (17/08/2026): a Mayra cadastrou uma conta a pagar com vencimento
 * 15/09 e a lista mostrou 14/09. O banco estava certo; o driver `pg` é que
 * transformava a `date` num `Date` na meia-noite LOCAL, e a VPS roda em
 * Europe/Berlin (UTC+2) — então `2026-09-15` virava `2026-09-14T22:00:00Z` no
 * JSON, e a tela, que corta os dez primeiros caracteres, mostrava o dia
 * anterior.
 *
 * Este teste roda com TZ=Europe/Berlin de propósito: é o fuso em que o bug
 * aparece. Em UTC ou em qualquer fuso a oeste ele passaria mesmo sem a
 * correção, e não protegeria nada.
 *
 * Sem `usarDatasComoTexto()` (src/lib/pgTypes.js), o primeiro teste falha.
 *
 *   npm test   (usa TEST_ADMIN_URL, default postgres@localhost)
 */

// ANTES de qualquer import que toque em Date: o Node lê TZ na primeira vez que
// precisa dele, e mudar depois não tem efeito garantido.
process.env.TZ = "Europe/Berlin";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { usarDatasComoTexto } from "../src/lib/pgTypes.js";

const ADMIN_URL =
  process.env.TEST_ADMIN_URL || "postgres://postgres@localhost:5432/postgres";
const TEST_DB = "vamaq_data_fuso_test";

let pool;

before(async () => {
  assert.equal(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    "Europe/Berlin",
    "o teste precisa rodar em Europe/Berlin para valer alguma coisa"
  );

  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  usarDatasComoTexto();

  const u = new URL(ADMIN_URL);
  pool = new pg.Pool({
    connectionString: `${u.protocol}//${u.username || "postgres"}@${u.hostname}:${u.port || 5432}/${TEST_DB}`,
  });
  await pool.query(`create table vencimentos (id serial primary key, quando date not null)`);
});

after(async () => {
  await pool?.end();
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.end();
});

test("a data volta exatamente como foi gravada, em texto", async () => {
  await pool.query(`insert into vencimentos (quando) values ('2026-09-15')`);
  const { rows } = await pool.query(`select quando from vencimentos where quando = '2026-09-15'`);
  assert.equal(rows[0].quando, "2026-09-15");
  assert.equal(typeof rows[0].quando, "string", "date tem que chegar como texto, não como Date");
});

test("sobrevive à ida e volta por JSON — que é onde o dia se perdia", async () => {
  const { rows } = await pool.query(`select quando from vencimentos limit 1`);
  // Este é o caminho real: a rota devolve NextResponse.json(...) e a tela
  // corta os dez primeiros caracteres.
  const viaRede = JSON.parse(JSON.stringify(rows[0]));
  assert.equal(String(viaRede.quando).slice(0, 10), "2026-09-15");
  assert.equal(
    String(viaRede.quando).slice(0, 10).split("-").reverse().join("/"),
    "15/09/2026",
    "é exatamente isto que a tela de contas a pagar mostra"
  );
});

test("as telas que formatam em UTC continuam certas", async () => {
  // funcionários e fiscal usam new Date(valor).toLocaleDateString('pt-BR',
  // { timeZone: 'UTC' }). Com texto ISO, o Date nasce meia-noite UTC e a
  // formatação em UTC devolve o mesmo dia — o remendo delas segue válido.
  const { rows } = await pool.query(`select quando from vencimentos limit 1`);
  const formatado = new Date(rows[0].quando).toLocaleDateString("pt-BR", { timeZone: "UTC" });
  assert.equal(formatado, "15/09/2026");
});

test("virada de mês e de ano não escorrega", async () => {
  for (const dia of ["2026-01-01", "2026-03-01", "2026-12-31", "2027-01-01"]) {
    await pool.query(`insert into vencimentos (quando) values ($1)`, [dia]);
    const { rows } = await pool.query(`select quando from vencimentos where quando = $1`, [dia]);
    assert.equal(rows[0].quando, dia, `${dia} voltou diferente`);
  }
});

test("ordenação por texto ISO é a mesma que por data", async () => {
  const { rows } = await pool.query(`select quando from vencimentos order by quando`);
  const vindos = rows.map((r) => r.quando);
  const ordenadosComoTexto = [...vindos].sort();
  assert.deepEqual(vindos, ordenadosComoTexto);
});
