/**
 * Contrato do schema de funcionários contra Postgres real.
 *
 *   1. ficha e vínculos são criados e ligados;
 *   2. no máximo UM vínculo aberto por funcionário;
 *   3. saída não pode ser anterior à admissão;
 *   4. users.funcionario_id liga o login à ficha, um por ficha.
 *
 *   npm test   (usa TEST_ADMIN_URL, default postgres@localhost)
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { DESLIGAR_SQL } from "../src/lib/rh/sql.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADMIN_URL =
  process.env.TEST_ADMIN_URL || "postgres://postgres@localhost:5432/postgres";
const TEST_DB = "vamaq_rh_test";

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
  for (const file of ["schema.sql", "auth-schema.sql", "funcionarios-schema.sql"]) {
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

async function novaFicha(nome, cpf = null) {
  const { rows } = await pool.query(
    `insert into funcionarios (nome, cpf) values ($1,$2) returning id`,
    [nome, cpf]
  );
  return rows[0].id;
}

test("ficha guarda vínculos e o cargo mora no vínculo", async () => {
  const id = await novaFicha("Ana Teste");
  await pool.query(
    `insert into funcionario_vinculos (funcionario_id, cargo, admissao, saida, motivo_saida)
     values ($1, 'Vendedora', '2023-01-10', '2024-05-31', 'Pedido de demissão')`,
    [id]
  );
  await pool.query(
    `insert into funcionario_vinculos (funcionario_id, cargo, admissao)
     values ($1, 'Gerente', '2026-02-01')`,
    [id]
  );
  const { rows } = await pool.query(
    `select cargo, saida from funcionario_vinculos
      where funcionario_id=$1 order by admissao`,
    [id]
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].cargo, "Vendedora");
  assert.equal(rows[1].cargo, "Gerente");
  assert.equal(rows[1].saida, null);
});

test("no máximo um vínculo aberto por funcionário", async () => {
  const id = await novaFicha("Bruno Teste");
  await pool.query(
    `insert into funcionario_vinculos (funcionario_id, cargo, admissao)
     values ($1, 'Lavador', '2026-01-05')`,
    [id]
  );
  await assert.rejects(
    () =>
      pool.query(
        `insert into funcionario_vinculos (funcionario_id, cargo, admissao)
         values ($1, 'Lavador', '2026-03-05')`,
        [id]
      ),
    /funcionario_vinculo_aberto_idx/
  );
});

test("saída não pode ser anterior à admissão", async () => {
  const id = await novaFicha("Carla Teste");
  await assert.rejects(
    () =>
      pool.query(
        `insert into funcionario_vinculos (funcionario_id, cargo, admissao, saida)
         values ($1, 'Secretária', '2026-04-01', '2026-03-01')`,
        [id]
      ),
    /vinculo_datas_check/
  );
});

test("CPF é único quando informado, e vários nulos convivem", async () => {
  await novaFicha("Sem CPF 1");
  await novaFicha("Sem CPF 2");
  await novaFicha("Com CPF", "52998224725");
  await assert.rejects(
    () => novaFicha("CPF repetido", "52998224725"),
    /funcionarios_cpf_key/
  );
});

test("um login por ficha; apagar a ficha não apaga o login", async () => {
  const id = await novaFicha("Diego Teste");
  await pool.query(
    `insert into users (name, email, password_hash, role, funcionario_id)
     values ('Diego Teste','diego@vamaqmotors.com.br','x','vendedor',$1)`,
    [id]
  );
  await assert.rejects(
    () =>
      pool.query(
        `insert into users (name, email, password_hash, role, funcionario_id)
         values ('Outro','outro@vamaqmotors.com.br','x','vendedor',$1)`,
        [id]
      ),
    /users_funcionario_idx/
  );

  await pool.query(`delete from funcionarios where id=$1`, [id]);
  const { rows } = await pool.query(
    `select funcionario_id from users where email='diego@vamaqmotors.com.br'`
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].funcionario_id, null);
});

test("desligar fecha o vínculo e desativa o login na mesma instrução", async () => {
  const id = await novaFicha("Elis Teste");
  await pool.query(
    `insert into funcionario_vinculos (funcionario_id, cargo, admissao)
     values ($1, 'Vendedora', '2026-01-02')`,
    [id]
  );
  await pool.query(
    `insert into users (name, email, password_hash, role, funcionario_id, active)
     values ('Elis Teste','elis@vamaqmotors.com.br','x','vendedor',$1,true)`,
    [id]
  );

  const { rows } = await pool.query(DESLIGAR_SQL, [id, "2026-06-30", "Fim de contrato"]);
  assert.ok(rows[0].vinculo_id, "devolve o vínculo fechado");
  assert.ok(rows[0].user_id, "devolve o login desativado");

  const v = await pool.query(
    `select saida, motivo_saida from funcionario_vinculos where funcionario_id=$1`,
    [id]
  );
  assert.equal(v.rows[0].motivo_saida, "Fim de contrato");
  assert.ok(v.rows[0].saida, "gravou a data de saída");

  const u = await pool.query(`select active from users where funcionario_id=$1`, [id]);
  assert.equal(u.rows[0].active, false);
});

test("desligar sem vínculo aberto devolve vinculo_id nulo", async () => {
  const id = await novaFicha("Fabio Teste");
  const { rows } = await pool.query(DESLIGAR_SQL, [id, "2026-06-30", null]);
  assert.equal(rows[0].vinculo_id, null);
});

test("desligar funcionário sem login devolve user_id nulo", async () => {
  const id = await novaFicha("Gil Teste");
  await pool.query(
    `insert into funcionario_vinculos (funcionario_id, cargo, admissao)
     values ($1, 'Mecânico', '2026-01-02')`,
    [id]
  );
  const { rows } = await pool.query(DESLIGAR_SQL, [id, "2026-07-01", null]);
  assert.ok(rows[0].vinculo_id);
  assert.equal(rows[0].user_id, null);
});

test("desligar com data anterior à admissão é rejeitado pelo CHECK", async () => {
  const id = await novaFicha("Hugo Teste");
  await pool.query(
    `insert into funcionario_vinculos (funcionario_id, cargo, admissao)
     values ($1, 'Lavador', '2026-05-01')`,
    [id]
  );
  await assert.rejects(
    () => pool.query(DESLIGAR_SQL, [id, "2026-04-01", null]),
    /vinculo_datas_check/
  );
});
