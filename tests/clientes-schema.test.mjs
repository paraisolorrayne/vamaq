/**
 * Contrato do schema de clientes contra Postgres real.
 *
 *   1. documento é opcional, mas quando presente é único;
 *   2. tipo é restrito a pf/pj;
 *   3. o mesmo vínculo cliente-veículo-papel não duplica, mas o mesmo carro
 *      pode ter dois papéis diferentes para o mesmo cliente;
 *   4. papel e origem são restritos aos valores válidos;
 *   5. apagar o cliente ou o veículo leva o vínculo junto; apagar o contrato
 *      NÃO leva o vínculo, só a referência a ele.
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
const TEST_DB = "vamaq_clientes_test";

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
  for (const f of ["schema.sql", "auth-schema.sql", "documentos-schema.sql", "fiscal-schema.sql", "clientes-schema.sql"]) {
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

async function novoCliente({ nome, tipo, doc }) {
  const { rows } = await pool.query(
    `insert into clientes (nome, tipo, doc) values ($1, coalesce($2,'pf'), $3) returning id`,
    [nome, tipo || null, doc || null]
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

async function novoDoc({ vehicleId = null, arquivo }) {
  const { rows } = await pool.query(
    `insert into documentos_gerados (tipo, titulo, cliente, vehicle_id, arquivo, tamanho)
     values ('venda','Contrato de Venda','Maria Souza',$1,$2,1234) returning id`,
    [vehicleId, arquivo]
  );
  return rows[0].id;
}

async function ligar(clienteId, vehicleId, papel, origem = "manual") {
  const { rows } = await pool.query(
    `insert into cliente_veiculos (cliente_id, vehicle_id, papel, origem) values ($1,$2,$3,$4) returning id`,
    [clienteId, vehicleId, papel, origem]
  );
  return rows[0].id;
}

test("dois clientes sem documento são aceitos", async () => {
  await novoCliente({ nome: "Sem Doc Um" });
  await novoCliente({ nome: "Sem Doc Dois" });
  const { rows } = await pool.query(`select count(*)::int n from clientes where doc is null`);
  assert.ok(rows[0].n >= 2);
});

test("dois clientes com o mesmo documento, não", async () => {
  await novoCliente({ nome: "Original", doc: "12345678900" });
  await assert.rejects(
    () => novoCliente({ nome: "Duplicado", doc: "12345678900" }),
    /clientes_doc_key/
  );
});

test("tipo só aceita pf e pj", async () => {
  await novoCliente({ nome: "PJ", tipo: "pj", doc: "12345678000190" });
  await assert.rejects(() => novoCliente({ nome: "Outro", tipo: "xx" }), /cliente_tipo_check/);
});

test("o mesmo vínculo duas vezes não duplica", async () => {
  const c = await novoCliente({ nome: "Com Carro" });
  const v = await novoVeiculo("gol-cliente");
  await ligar(c, v, "comprou");
  await assert.rejects(() => ligar(c, v, "comprou"), /cliente_veiculos_unico/);
});

test("o mesmo cliente pode ter dois papéis no mesmo carro", async () => {
  const c = await novoCliente({ nome: "Vendeu e Recomprou" });
  const v = await novoVeiculo("onix-cliente");
  await ligar(c, v, "vendeu");
  await ligar(c, v, "comprou"); // não pode rejeitar
});

test("papel e origem são restritos", async () => {
  const c = await novoCliente({ nome: "Papel" });
  const v = await novoVeiculo("hb20-cliente");
  await assert.rejects(() => ligar(c, v, "emprestou"), /cliente_veiculo_papel_check/);
  await assert.rejects(() => ligar(c, v, "comprou", "sei-la"), /cliente_veiculo_origem_check/);
});

test("apagar o cliente leva o vínculo junto, mas NÃO o contrato nem a nota", async () => {
  const c = await novoCliente({ nome: "Cliente Com Prova" });
  const v = await novoVeiculo("hilux-cliente");
  const vinculoId = await ligar(c, v, "comprou");

  const d = await novoDoc({ vehicleId: v, arquivo: "2026/prova-cliente.pdf" });
  await pool.query(`update documentos_gerados set cliente_id = $1 where id = $2`, [c, d]);

  const nf = await pool.query(
    `insert into notas_fiscais (ref, vehicle_id, cliente_id) values ($1,$2,$3) returning id`,
    [`nf-cliente-${c}`, v, c]
  );

  await pool.query(`delete from clientes where id = $1`, [c]);

  const vinculo = await pool.query(`select id from cliente_veiculos where id = $1`, [vinculoId]);
  assert.equal(vinculo.rows.length, 0);

  const doc = await pool.query(`select cliente_id from documentos_gerados where id = $1`, [d]);
  assert.equal(doc.rows.length, 1);
  assert.equal(doc.rows[0].cliente_id, null);

  const nota = await pool.query(`select cliente_id from notas_fiscais where id = $1`, [nf.rows[0].id]);
  assert.equal(nota.rows.length, 1);
  assert.equal(nota.rows[0].cliente_id, null);
});

test("apagar o veículo leva o vínculo junto", async () => {
  const c = await novoCliente({ nome: "Cliente Sem Carro" });
  const v = await novoVeiculo("kicks-cliente");
  const vinculoId = await ligar(c, v, "comprou");

  await pool.query(`delete from vehicles where id = $1`, [v]);

  const { rows } = await pool.query(`select id from cliente_veiculos where id = $1`, [vinculoId]);
  assert.equal(rows.length, 0);
});

test("apagar o documento não apaga o vínculo, só a origem dele", async () => {
  const c = await novoCliente({ nome: "Cliente Com Documento" });
  const v = await novoVeiculo("captur-cliente");
  const d = await novoDoc({ vehicleId: v, arquivo: "2026/origem-vinculo.pdf" });

  const { rows } = await pool.query(
    `insert into cliente_veiculos (cliente_id, vehicle_id, papel, origem, documento_id)
     values ($1,$2,'comprou','contrato',$3) returning id`,
    [c, v, d]
  );
  const vinculoId = rows[0].id;

  await pool.query(`delete from documentos_gerados where id = $1`, [d]);

  const vinculo = await pool.query(
    `select documento_id from cliente_veiculos where id = $1`,
    [vinculoId]
  );
  assert.equal(vinculo.rows.length, 1);
  assert.equal(vinculo.rows[0].documento_id, null);
});
