/**
 * Pedido de redefinição de senha, contra Postgres real.
 *
 * O que este teste protege — tudo coisa que falha CALADA se alguém mexer:
 *
 *   1. pedir marca o horário de quem existe e está ativo;
 *   2. usuário INATIVO não é marcado (desligado não reabre a própria porta);
 *   3. e-mail que não existe não quebra nem cria linha;
 *   4. pedir de novo dentro de 10 minutos não reescreve o horário;
 *   5. redefinir a senha limpa o pedido — senão o aviso fica pendurado na
 *      tela do admin para sempre e ele perde a confiança no aviso.
 *
 * Extrai as consultas do texto-fonte (os módulos usam o alias "@/", que não
 * resolve em `node --test`) e as executa de verdade, como vehicles-select.
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
const TEST_DB = "vamaq_reset_senha_test";

function urlFor(user) {
  const u = new URL(ADMIN_URL);
  return `${u.protocol}//${user}@${u.hostname}:${u.port || 5432}/${TEST_DB}`;
}

let pool;
let SQL_PEDIR; // src/lib/auth/resetRequest.js
let SQL_LIMPAR; // idem
let SQL_RESET; // o update de resetPassword em src/lib/auth/users.js

function extrai(fonte, nome, regex, arquivo) {
  const m = fonte.match(regex);
  assert.ok(m, `${nome} não encontrado em ${arquivo}`);
  return m[1];
}

async function criaUsuario({ email, active = true }) {
  const { rows } = await pool.query(
    `insert into users (name, email, password_hash, role, active)
     values ('Teste', $1, 'scrypt$x', 'vendedor', $2) returning id`,
    [email, active]
  );
  return rows[0].id;
}

before(async () => {
  const src = await readFile(
    path.join(ROOT, "src", "lib", "auth", "resetRequest.js"),
    "utf8"
  );
  SQL_PEDIR = extrai(src, "SQL_PEDIR", /const SQL_PEDIR = `([\s\S]*?)`;/, "resetRequest.js");
  SQL_LIMPAR = extrai(src, "SQL_LIMPAR", /const SQL_LIMPAR = `([\s\S]*?)`;/, "resetRequest.js");

  const usersSrc = await readFile(
    path.join(ROOT, "src", "lib", "auth", "users.js"),
    "utf8"
  );
  SQL_RESET = extrai(
    usersSrc,
    "update de resetPassword",
    /resetPassword\(id\) \{[\s\S]*?query\(\s*`([\s\S]*?)`/,
    "users.js"
  );

  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const su = new URL(ADMIN_URL).username || "postgres";
  pool = new pg.Pool({ connectionString: urlFor(su) });
  // funcionarios-schema traz users.funcionario_id, que o select de listUsers cita.
  for (const f of [
    "schema.sql",
    "auth-schema.sql",
    "funcionarios-schema.sql",
    "auth-reset-senha.sql",
  ]) {
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

test("a migration é idempotente — reaplicar não quebra", async () => {
  const sql = await readFile(path.join(ROOT, "db", "auth-reset-senha.sql"), "utf8");
  await pool.query(sql);
  await pool.query(sql);
});

test("pedido de quem existe e está ativo marca o horário", async () => {
  await criaUsuario({ email: "ativa@vamaqmotors.com.br" });
  const r = await pool.query(SQL_PEDIR, ["ativa@vamaqmotors.com.br"]);
  assert.equal(r.rowCount, 1);

  const { rows } = await pool.query(
    `select reset_requested_at from users where email = $1`,
    ["ativa@vamaqmotors.com.br"]
  );
  assert.ok(rows[0].reset_requested_at, "o pedido deveria ter horário");
});

test("usuário inativo não é marcado — desligado não reabre a própria porta", async () => {
  await criaUsuario({ email: "desligado@vamaqmotors.com.br", active: false });
  const r = await pool.query(SQL_PEDIR, ["desligado@vamaqmotors.com.br"]);
  assert.equal(r.rowCount, 0);

  const { rows } = await pool.query(
    `select reset_requested_at from users where email = $1`,
    ["desligado@vamaqmotors.com.br"]
  );
  assert.equal(rows[0].reset_requested_at, null);
});

test("e-mail que não existe não quebra e não cria nada", async () => {
  const r = await pool.query(SQL_PEDIR, ["ninguem@exemplo.com"]);
  assert.equal(r.rowCount, 0);
  const { rows } = await pool.query(`select count(*)::int as n from users where email = $1`, [
    "ninguem@exemplo.com",
  ]);
  assert.equal(rows[0].n, 0);
});

test("pedir de novo dentro de 10 minutos não reescreve o horário", async () => {
  const email = "repetida@vamaqmotors.com.br";
  await criaUsuario({ email });
  await pool.query(SQL_PEDIR, [email]);
  const antes = (
    await pool.query(`select reset_requested_at from users where email = $1`, [email])
  ).rows[0].reset_requested_at;

  const r = await pool.query(SQL_PEDIR, [email]);
  assert.equal(r.rowCount, 0, "o segundo pedido não deveria atualizar");

  const depois = (
    await pool.query(`select reset_requested_at from users where email = $1`, [email])
  ).rows[0].reset_requested_at;
  assert.deepEqual(depois, antes);
});

test("passados os 10 minutos, um novo pedido volta a valer", async () => {
  const email = "antiga@vamaqmotors.com.br";
  const id = await criaUsuario({ email });
  await pool.query(
    `update users set reset_requested_at = now() - interval '11 minutes' where id = $1`,
    [id]
  );
  const r = await pool.query(SQL_PEDIR, [email]);
  assert.equal(r.rowCount, 1);
});

test("redefinir a senha limpa o pedido pendente", async () => {
  const email = "redefinida@vamaqmotors.com.br";
  const id = await criaUsuario({ email });
  await pool.query(SQL_PEDIR, [email]);

  // O mesmo update que resetPassword() roda em produção.
  await pool.query(SQL_RESET, [id, "scrypt$novo"]);

  const { rows } = await pool.query(
    `select reset_requested_at, must_change_password from users where id = $1`,
    [id]
  );
  assert.equal(rows[0].reset_requested_at, null, "o pedido tinha que sumir da lista do admin");
  assert.equal(rows[0].must_change_password, true, "a troca no 1º acesso continua obrigatória");
});

test("limpar o pedido não mexe na senha nem no papel", async () => {
  const email = "limpa@vamaqmotors.com.br";
  const id = await criaUsuario({ email });
  await pool.query(SQL_PEDIR, [email]);
  await pool.query(SQL_LIMPAR, [id]);

  const { rows } = await pool.query(
    `select reset_requested_at, password_hash, role from users where id = $1`,
    [id]
  );
  assert.equal(rows[0].reset_requested_at, null);
  assert.equal(rows[0].password_hash, "scrypt$x");
  assert.equal(rows[0].role, "vendedor");
});

test("listUsers devolve a coluna do pedido — sem ela o admin não vê o aviso", async () => {
  const usersSrc = await readFile(path.join(ROOT, "src", "lib", "auth", "users.js"), "utf8");
  const select = extrai(
    usersSrc,
    "select de listUsers",
    /listUsers\(\) \{[\s\S]*?query\(\s*`([\s\S]*?)`/,
    "users.js"
  );
  assert.match(select, /\breset_requested_at\b/);
  await pool.query(select); // roda de verdade: pega coluna inexistente ou typo
});
