/**
 * Amarra as colunas `v.ano_modelo` e `v.placa` ao SELECT do CRM
 * (src/lib/crm/oportunidades.js) — a terceira consulta da família que
 * tests/vehicles-select.test.mjs já protege para o painel (vehicleStore.js)
 * e o site público (repositories/vehicles.js).
 *
 * Por que um arquivo à parte em vez de estender vehicles-select.test.mjs:
 * as duas consultas de lá fazem `select ... from vehicles` sozinhas; esta
 * faz `from oportunidades o left join vehicles v ... left join users u`,
 * então precisa de um banco de teste com mais schema aplicado (crm-schema.sql
 * e auth-schema.sql, além do schema.sql base) e de uma semeadura com três
 * tabelas em vez de uma. Separar evita inflar o setup do arquivo original
 * com tabelas que as outras duas consultas não tocam.
 *
 * `anoVeiculo()` (src/lib/anoVeiculo.js) é pura e não valida nada: se
 * `ano_modelo` sumir do SELECT numa edição futura, o rótulo do veículo na
 * tela do CRM volta a "2021" calado. Se `placa` sumir, a tela de vender
 * (a única irreversível da entrega) mostra o carro sem placa, também
 * calada. Este teste é o que quebra nos dois cenários.
 *
 * Extrai o texto-fonte do SELECT por regex (não importa o módulo: ele usa
 * o alias "@/", que não resolve em `node --test`) e roda a consulta de
 * verdade contra um Postgres descartável, com uma oportunidade semeada de
 * ponta a ponta (cliente + veículo + responsável).
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
const TEST_DB = "vamaq_crm_vehicles_select_test";

function urlFor(user) {
  const u = new URL(ADMIN_URL);
  return `${u.protocol}//${user}@${u.hostname}:${u.port || 5432}/${TEST_DB}`;
}

let pool;
let SELECT; // src/lib/crm/oportunidades.js — statement completo ("select ... from oportunidades o ...")

before(async () => {
  // 1. Extrai o SELECT do texto-fonte.
  const src = await readFile(
    path.join(ROOT, "src", "lib", "crm", "oportunidades.js"),
    "utf8"
  );
  const match = src.match(/const SELECT = `([\s\S]*?)`;/);
  assert.ok(match, "SELECT não encontrado em src/lib/crm/oportunidades.js");
  SELECT = match[1];
  assert.match(SELECT, /\bv\.ano_modelo\b/, "SELECT (crm/oportunidades.js) não menciona v.ano_modelo");
  assert.match(SELECT, /\bv\.placa\b/, "SELECT (crm/oportunidades.js) não menciona v.placa");

  // 2. Banco descartável com o schema real aplicado: base (vehicles) +
  //    auth (users, referenciado por oportunidades.responsavel_id) + crm
  //    (oportunidades, que o SELECT lê e faz join com vehicles/users).
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const su = new URL(ADMIN_URL).username || "postgres";
  pool = new pg.Pool({ connectionString: urlFor(su) });
  // crm-schema.sql agora referencia clientes(id) (oportunidades.cliente_id),
  // que por sua vez referencia documentos_gerados/notas_fiscais — daí a
  // cadeia toda antes dele, na mesma ordem de tests/clientes-schema.test.mjs.
  for (const f of ["schema.sql", "auth-schema.sql", "documentos-schema.sql", "fiscal-schema.sql", "clientes-schema.sql", "crm-schema.sql"]) {
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
let userSeq = 0;

async function novoVeiculo({ year, ano_modelo, placa }) {
  const slug = `veiculo-crm-select-${++slugSeq}`;
  const { rows } = await pool.query(
    `insert into vehicles (slug, brand, model, year, price, ano_modelo, placa)
     values ($1,'Audi','Q5',$2,200000,$3,$4) returning id`,
    [slug, year, ano_modelo ?? null, placa ?? null]
  );
  return rows[0].id;
}

async function novoUsuario() {
  const email = `vendedor-crm-select-${++userSeq}@vamaq.test`;
  const { rows } = await pool.query(
    `insert into users (name, email, password_hash, role)
     values ('Vendedor Teste', $1, 'x', 'vendedor') returning id`,
    [email]
  );
  return rows[0].id;
}

async function novaOportunidade({ vehicleId, responsavelId }) {
  const { rows } = await pool.query(
    `insert into oportunidades (cliente_nome, vehicle_id, responsavel_id)
     values ('Cliente Teste', $1, $2) returning id`,
    [vehicleId, responsavelId]
  );
  return rows[0].id;
}

test("SELECT do CRM (crm/oportunidades.js) traz vehicle_ano_modelo e vehicle_placa", async () => {
  const vehicleId = await novoVeiculo({ year: 2021, ano_modelo: 2022, placa: "ABC1D23" });
  const responsavelId = await novoUsuario();
  const oportunidadeId = await novaOportunidade({ vehicleId, responsavelId });

  const { rows } = await pool.query(`${SELECT} where o.id = $1`, [oportunidadeId]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].vehicle_ano_modelo, 2022);
  assert.equal(rows[0].vehicle_placa, "ABC1D23");
  assert.equal(rows[0].responsavel_nome, "Vendedor Teste");
});
