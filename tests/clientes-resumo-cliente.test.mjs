/**
 * A barreira contra vazamento fiscal, e a consulta nova de oportunidades na
 * ficha — os dois em src/lib/clientes/repo.js, contra Postgres real.
 *
 * `resumoCliente()` existe por um motivo específico (ver o comentário dela em
 * repo.js): a tela da oportunidade do CRM, aberta pelo VENDEDOR, só precisa
 * do número de carros do cliente para o texto "N carros no histórico" — mas
 * `getCliente()` monta a ficha inteira, e isso inclui `notas` (ref, status e
 * valor de notas fiscais), dado que o vendedor não tem acesso (o GET da
 * ficha completa é fechado para ele de propósito, ver
 * tests/clientes-autorizacao.test.mjs). Nada testava que `resumoCliente()`
 * continua enxuta — um `select *` descuidado num refactor futuro passaria
 * despercebido. Este teste afirma que ela devolve EXATAMENTE as chaves `id`,
 * `nome` e `veiculos_count`, nada mais.
 *
 * Também cobre a consulta de `oportunidades` que `getCliente()` ganhou nesta
 * entrega — é o que alimenta o bloco "Oportunidades" da ficha do cliente.
 *
 * Usa o mesmo arnês de tests/crm-registrar-venda.test.mjs (que por sua vez
 * reaproveita tests/helpers/mock-session-loader.mjs, o de
 * tests/crm-autorizacao.test.mjs e tests/clientes-autorizacao.test.mjs): o
 * hook resolve o alias "@/" para src/, o que basta aqui — repo.js não toca
 * em sessão nem em next/cache, mas registrar o mesmo hook não atrapalha.
 * Schema aplicado com db/aplicar-schemas.sh (a ordem certa dos sete
 * arquivos — ver o cabeçalho dele).
 *
 *   npm test   (usa TEST_ADMIN_URL, default postgres@localhost; precisa de
 *               psql no PATH — ver db/aplicar-schemas.sh)
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./tests/helpers/mock-session-loader.mjs", pathToFileURL("./"));

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const execFileAsync = promisify(execFile);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADMIN_URL =
  process.env.TEST_ADMIN_URL || "postgres://postgres@localhost:5432/postgres";
const TEST_DB = "vamaq_clientes_resumo_test";

function urlFor(user) {
  const u = new URL(ADMIN_URL);
  return `${u.protocol}//${user}@${u.hostname}:${u.port || 5432}/${TEST_DB}`;
}

let pool;
let resumoCliente;
let getCliente;
let getAppPool; // @/lib/db (getPool) — o pool que repo.js usa de verdade

before(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const su = new URL(ADMIN_URL).username || "postgres";
  const dbUrl = urlFor(su);

  await execFileAsync(path.join(ROOT, "db", "aplicar-schemas.sh"), [dbUrl]);

  pool = new pg.Pool({ connectionString: dbUrl });

  // @/lib/db lê DATABASE_URL uma única vez, no primeiro getPool() — setar
  // antes de qualquer chamada faz resumoCliente/getCliente usarem este banco
  // descartável.
  process.env.DATABASE_URL = dbUrl;

  ({ resumoCliente, getCliente } = await import("@/lib/clientes/repo"));
  ({ getPool: getAppPool } = await import("@/lib/db"));
});

after(async () => {
  await pool?.end();
  // Sem fechar o pool interno de @/lib/db, o DROP DATABASE abaixo trava
  // esperando a conexão soltar — ver o mesmo comentário em
  // tests/crm-registrar-venda.test.mjs.
  await getAppPool?.()?.end();
  delete process.env.DATABASE_URL;
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.end();
});

let slugSeq = 0;

async function novoVeiculo() {
  const slug = `clientes-resumo-${++slugSeq}`;
  const { rows } = await pool.query(
    `insert into vehicles (slug, brand, model, year, price)
     values ($1,'Toyota','Hilux',2023,250000) returning id`,
    [slug]
  );
  return rows[0].id;
}

async function novoCliente(data = {}) {
  const { rows } = await pool.query(
    `insert into clientes (nome, obs, rg) values ($1,$2,$3) returning id`,
    [data.nome || "Cliente Resumo", data.obs || "nota interna que o vendedor não pode ver", data.rg || "MG-1"]
  );
  return rows[0].id;
}

async function ligar(clienteId, vehicleId, papel = "comprou", origem = "manual") {
  await pool.query(
    `insert into cliente_veiculos (cliente_id, vehicle_id, papel, origem) values ($1,$2,$3,$4)`,
    [clienteId, vehicleId, papel, origem]
  );
}

test("resumoCliente devolve EXATAMENTE id, nome e veiculos_count — nada mais", async () => {
  const clienteId = await novoCliente({ nome: "Cliente Barreira Fiscal" });
  const v1 = await novoVeiculo();
  const v2 = await novoVeiculo();
  await ligar(clienteId, v1);
  await ligar(clienteId, v2);

  const resumo = await resumoCliente(clienteId);

  assert.deepEqual(
    Object.keys(resumo).sort(),
    ["id", "nome", "veiculos_count"].sort(),
    "resumoCliente não pode trazer mais campos do que o vendedor tem acesso (ex.: obs, rg, notas fiscais)"
  );
  assert.equal(resumo.nome, "Cliente Barreira Fiscal");
  assert.equal(resumo.veiculos_count, 2);
});

test("resumoCliente de um id que não existe devolve null", async () => {
  const resumo = await resumoCliente("00000000-0000-0000-0000-000000000000");
  assert.equal(resumo, null);
});

test("getCliente().oportunidades traz só as oportunidades daquele cliente", async () => {
  const clienteId = await novoCliente({ nome: "Cliente Com Oportunidades" });
  const outroClienteId = await novoCliente({ nome: "Outro Cliente" });
  const vehicleId = await novoVeiculo();

  await pool.query(
    `insert into oportunidades (cliente_nome, cliente_id, vehicle_id, etapa, valor)
     values ('Como Foi Digitado Na Oportunidade', $1, $2, 'ganho', 150000)`,
    [clienteId, vehicleId]
  );
  // De outro cliente — não pode aparecer na ficha do primeiro.
  await pool.query(
    `insert into oportunidades (cliente_nome, cliente_id, etapa)
     values ('Não É Deste Cliente', $1, 'novo')`,
    [outroClienteId]
  );

  const ficha = await getCliente(clienteId);

  assert.equal(ficha.oportunidades.length, 1);
  const [oportunidade] = ficha.oportunidades;
  assert.equal(oportunidade.cliente_nome, "Como Foi Digitado Na Oportunidade");
  assert.equal(oportunidade.etapa, "ganho");
  assert.equal(Number(oportunidade.valor), 150000);
  assert.equal(oportunidade.vehicle_brand, "Toyota");
  assert.equal(oportunidade.vehicle_model, "Hilux");
  assert.equal(oportunidade.vehicle_year, 2023);
});

test("getCliente().oportunidades vem vazio quando o cliente não tem nenhuma", async () => {
  const clienteId = await novoCliente({ nome: "Cliente Sem Oportunidade" });
  const ficha = await getCliente(clienteId);
  assert.deepEqual(ficha.oportunidades, []);
});
