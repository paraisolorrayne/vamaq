/**
 * "Um carro vendido pelo CRM não aparecia na ficha do cliente" — o problema
 * que esta entrega resolve (ver
 * docs/superpowers/specs/2026-08-09-crm-cliente-design.md). Até esta rodada,
 * nenhum teste cobria isso. Este cobre o caminho de verdade:
 * PATCH /api/admin/crm/oportunidades/[id] com {action:"registrar-venda"},
 * que por baixo chama ligarVeiculo (src/lib/clientes/repo.js).
 *
 * Usa o mesmo arnês de tests/crm-autorizacao.test.mjs e
 * tests/clientes-autorizacao.test.mjs (tests/helpers/mock-session-loader.mjs)
 * para importar o Route Handler de verdade em `node --test`. Diferente
 * daqueles dois — que dependem do banco vazio (`query()` devolve `{rows: []}`
 * sem DATABASE_URL) — aqui o banco PRECISA existir de verdade: setEtapa,
 * ligarVeiculo e setVehicleStatus fazem UPDATE/INSERT reais, e o teste
 * verifica o que ficou gravado. `DATABASE_URL` é setado, antes de qualquer
 * chamada, para o banco descartável criado abaixo — `@/lib/db` (usado por
 * oportunidades.js, clientes/repo.js e vehicleStore.js) mantém um pool único
 * por processo, e `node --test` roda cada arquivo de teste em processo
 * próprio, então isto não vaza para os outros arquivos.
 *
 * O schema é aplicado com db/aplicar-schemas.sh — o script que resolve a
 * ordem de dependência entre os sete arquivos (ver o cabeçalho dele) — em vez
 * de repetir a lista aqui pela terceira vez (crm-cliente-schema.test.mjs e
 * crm-oportunidades-update.test.mjs já a repetem duas).
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
const TEST_DB = "vamaq_crm_registrar_venda_test";

function urlFor(user) {
  const u = new URL(ADMIN_URL);
  return `${u.protocol}//${user}@${u.hostname}:${u.port || 5432}/${TEST_DB}`;
}

let pool;
let oportunidadeIdRoute;
let ligarVeiculoRepo;

let getAppPool; // @/lib/db (getPool) — o pool que o Route Handler usa de verdade

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
  // antes de qualquer chamada faz o Route Handler (e ligarVeiculo/
  // setVehicleStatus, por baixo) usarem este banco descartável.
  process.env.DATABASE_URL = dbUrl;

  oportunidadeIdRoute = await import(
    "../src/app/api/admin/crm/oportunidades/[id]/route.js"
  );
  ({ ligarVeiculo: ligarVeiculoRepo } = await import("@/lib/clientes/repo"));
  ({ getPool: getAppPool } = await import("@/lib/db"));
});

after(async () => {
  await pool?.end();
  // getPool() de @/lib/db é um singleton por processo — o Route Handler e
  // ligarVeiculo o abriram por baixo dos panos, e ele nunca fecha sozinho.
  // Sem fechar aqui, a conexão fica presa no banco descartável: o DROP
  // DATABASE abaixo trava esperando ela soltar, e o processo de teste nunca
  // termina sozinho.
  await getAppPool?.()?.end();
  delete process.env.DATABASE_URL;
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.end();
});

let slugSeq = 0;

async function novoVeiculo() {
  const slug = `crm-venda-${++slugSeq}`;
  const { rows } = await pool.query(
    `insert into vehicles (slug, brand, model, year, price)
     values ($1,'Audi','Q5',2022,200000) returning id`,
    [slug]
  );
  return rows[0].id;
}

async function novoCliente(nome) {
  const { rows } = await pool.query(
    `insert into clientes (nome) values ($1) returning id`,
    [nome]
  );
  return rows[0].id;
}

async function novaOportunidadeGanha({ clienteId = null, vehicleId }) {
  const { rows } = await pool.query(
    `insert into oportunidades (cliente_nome, cliente_id, vehicle_id, etapa)
     values ('Lead Ganho', $1, $2, 'ganho') returning id`,
    [clienteId, vehicleId]
  );
  return rows[0].id;
}

function patchRegistrarVenda(id) {
  globalThis.__TEST_SESSION_USER__ = { id: "u-vendedor", role: "vendedor" };
  return oportunidadeIdRoute.PATCH(
    new Request(`http://localhost/api/admin/crm/oportunidades/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "registrar-venda" }),
    }),
    { params: Promise.resolve({ id }) }
  );
}

async function vinculosDe(clienteId, vehicleId) {
  const { rows } = await pool.query(
    `select * from cliente_veiculos where cliente_id = $1 and vehicle_id = $2`,
    [clienteId, vehicleId]
  );
  return rows;
}

test("registrar-venda com cliente_id e vehicle_id cria o vínculo, papel comprou, origem crm", async () => {
  const vehicleId = await novoVeiculo();
  const clienteId = await novoCliente("Cliente Comprou Pelo CRM");
  const id = await novaOportunidadeGanha({ clienteId, vehicleId });

  const res = await patchRegistrarVenda(id);
  assert.equal(res.status, 200);

  const rows = await vinculosDe(clienteId, vehicleId);
  assert.equal(rows.length, 1, "o vínculo cliente-veículo tem que existir depois da venda");
  assert.equal(rows[0].papel, "comprou");
  assert.equal(rows[0].origem, "crm");
});

test("registrar-venda sem cliente_id vende o veículo e não cria vínculo nenhum", async () => {
  const vehicleId = await novoVeiculo();
  const id = await novaOportunidadeGanha({ clienteId: null, vehicleId });

  const res = await patchRegistrarVenda(id);
  assert.equal(res.status, 200);

  const { rows: veiculo } = await pool.query(
    `select status from vehicles where id = $1`,
    [vehicleId]
  );
  assert.equal(
    veiculo[0].status,
    "vendido",
    "a venda tem que acontecer mesmo sem cliente vinculado"
  );

  const { rows: vinculos } = await pool.query(
    `select * from cliente_veiculos where vehicle_id = $1`,
    [vehicleId]
  );
  assert.equal(vinculos.length, 0, "sem cliente_id não pode nascer vínculo nenhum");
});

test("registrar-venda não duplica um vínculo que já existia (ex.: criado por contrato)", async () => {
  const vehicleId = await novoVeiculo();
  const clienteId = await novoCliente("Cliente Já Vinculado Por Contrato");
  await pool.query(
    `insert into cliente_veiculos (cliente_id, vehicle_id, papel, origem)
     values ($1,$2,'comprou','contrato')`,
    [clienteId, vehicleId]
  );
  const id = await novaOportunidadeGanha({ clienteId, vehicleId });

  const res = await patchRegistrarVenda(id);
  assert.equal(res.status, 200);

  const rows = await vinculosDe(clienteId, vehicleId);
  assert.equal(rows.length, 1, "não pode duplicar o vínculo já existente");
  assert.equal(
    rows[0].origem,
    "contrato",
    "o on conflict do nothing não pode sobrescrever a origem que já existia"
  );
});

// Fragilidade registrada na revisão desta entrega: ligarVeiculo devolve
// {error} em vez de lançar quando `papel` é inválido, e o try/catch do PATCH
// (registrar-venda) só pega exceção — o retorno de ligarVeiculo é descartado
// sem ninguém olhar. Hoje o PATCH sempre chama com papel: "comprou" (não há
// caminho pela API para mandar um papel inválido), então este teste cobre o
// CONTRATO da unidade isolada — o Route Handler continua fora do alcance
// deste teste porque não existe hoje um jeito de fazê-lo passar um papel
// diferente de "comprou".
test("ligarVeiculo devolve {error} (não lança) para papel inválido — contrato frouxo com quem chama", async () => {
  const vehicleId = await novoVeiculo();
  const clienteId = await novoCliente("Cliente Papel Invalido");

  const resultado = await ligarVeiculoRepo({
    clienteId,
    vehicleId,
    papel: "papel-que-nao-existe",
    origem: "crm",
  });
  assert.deepEqual(resultado, { error: "Papel inválido." });

  const { rows } = await pool.query(
    `select * from cliente_veiculos where cliente_id = $1 and vehicle_id = $2`,
    [clienteId, vehicleId]
  );
  assert.equal(rows.length, 0, "papel inválido não pode criar linha nenhuma");
});
