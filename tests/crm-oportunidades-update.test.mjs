/**
 * Regressão: editar uma oportunidade não pode mexer em `etapa` nem em
 * `motivo_perda`.
 *
 * O formulário de edição (FormOportunidade.js) não tem campo para nenhuma
 * das duas colunas. `normalize()`, em src/lib/crm/oportunidades.js, cai no
 * fallback "novo" quando `etapa` não vem no corpo — então um UPDATE que
 * incluísse essas colunas apagava a etapa e o motivo da perda de QUALQUER
 * oportunidade editada, mesmo editando só o telefone. Reproduzido no app:
 * uma oportunidade em Ganho virava Novo (com o carro ainda vendido) e uma
 * Perdida virava Novo com o motivo apagado. Sem erro, sem aviso.
 *
 * `updateOportunidade` importa `@/lib/db` (alias que não resolve em
 * `node --test`), então este teste não a importa: extrai o texto-fonte da
 * query UPDATE por regex — mesmo padrão de tests/vehicles-select.test.mjs —
 * e roda essa query de verdade contra um Postgres descartável, com o schema
 * real aplicado, provando que as colunas `etapa` e `motivo_perda` NÃO
 * aparecem entre as colunas atualizadas.
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
const TEST_DB = "vamaq_crm_update_test";

function urlFor(user) {
  const u = new URL(ADMIN_URL);
  return `${u.protocol}//${user}@${u.hostname}:${u.port || 5432}/${TEST_DB}`;
}

let pool;
let UPDATE; // src/lib/crm/oportunidades.js — statement completo do UPDATE

// Posição → coluna, lida do próprio bloco SET do UPDATE (antes do WHERE) —
// não de $1, que é o id usado no WHERE e é tratado à parte em params()
// abaixo. Já quebrou duas vezes com coluna nova (a última foi remendada com
// um `null` solto no fim de uma lista posicional fixa); derivando a ordem do
// texto de verdade, uma coluna nova entra sozinha como null, sem editar este
// arquivo — e as duas asserções logo abaixo continuam travando que `etapa` e
// `motivo_perda` nunca apareçam no SET.
let COLUNA_POR_POSICAO = [];

before(async () => {
  // 1. Extrai a query do texto-fonte (não importa o módulo: usa "@/lib/db",
  //    que não resolve em node --test).
  const src = await readFile(
    path.join(ROOT, "src", "lib", "crm", "oportunidades.js"),
    "utf8"
  );
  const match = src.match(/const UPDATE = `([\s\S]*?)`;/);
  assert.ok(match, "UPDATE não encontrado em src/lib/crm/oportunidades.js");
  UPDATE = match[1];
  assert.doesNotMatch(
    UPDATE,
    /\betapa\s*=/,
    "UPDATE (oportunidades.js) não pode gravar a coluna etapa"
  );
  assert.doesNotMatch(
    UPDATE,
    /\bmotivo_perda\s*=/,
    "UPDATE (oportunidades.js) não pode gravar a coluna motivo_perda"
  );

  // "where id=$1" casa o mesmo padrão `coluna=$n` — por isso a extração olha
  // só o trecho entre SET e WHERE, e `id` fica de fora do mapa (é tratado à
  // parte em params()).
  const setTrecho = UPDATE.match(/\bset\b([\s\S]*?)\bwhere\b/i);
  assert.ok(setTrecho, "não achei o bloco SET...WHERE no UPDATE");
  for (const [, coluna, posicao] of setTrecho[1].matchAll(/(\w+)\s*=\s*\$(\d+)/g)) {
    COLUNA_POR_POSICAO[Number(posicao)] = coluna;
  }

  // 2. Banco descartável com o schema real aplicado.
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

async function novoVeiculo() {
  const slug = `crm-update-${++slugSeq}`;
  const { rows } = await pool.query(
    `insert into vehicles (slug, brand, model, year, price)
     values ($1,'Audi','Q5',2022,200000) returning id`,
    [slug]
  );
  return rows[0].id;
}

// Monta a lista posicional pelo NOME da coluna, usando COLUNA_POR_POSICAO
// (derivado do UPDATE de verdade em before()) — só as colunas que o teste
// que chama informa em `valores`; o resto vira null sozinho. `id` é sempre o
// primeiro parâmetro (é o que o WHERE usa), por isso entra à parte.
function params(id, valores) {
  const out = [id];
  for (let posicao = 2; posicao < COLUNA_POR_POSICAO.length; posicao++) {
    const coluna = COLUNA_POR_POSICAO[posicao];
    out.push(valores[coluna] ?? null);
  }
  return out;
}

test("editar (UPDATE do repositório, sem etapa/motivo_perda) não mexe em etapa nem motivo_perda — oportunidade Ganha", async () => {
  const vehicleId = await novoVeiculo();
  const { rows } = await pool.query(
    `insert into oportunidades (cliente_nome, telefone, vehicle_id, etapa, motivo_perda)
     values ('Maria Ganha', '34999990000', $1, 'ganho', 'não deveria existir, mas prova que não é tocado')
     returning id`,
    [vehicleId]
  );
  const id = rows[0].id;

  // Reproduz exatamente o que updateOportunidade faz: roda o UPDATE
  // extraído do módulo, com o corpo que o formulário de edição manda de
  // verdade (sem etapa, sem motivo_perda) — só editando o telefone.
  await pool.query(
    UPDATE,
    params(id, { cliente_nome: "Maria Ganha", telefone: "34988880000", vehicle_id: vehicleId })
  );

  const { rows: depois } = await pool.query(
    `select etapa, motivo_perda, telefone from oportunidades where id = $1`,
    [id]
  );
  assert.equal(depois[0].etapa, "ganho", "etapa não pode mudar ao editar");
  assert.equal(
    depois[0].motivo_perda,
    "não deveria existir, mas prova que não é tocado",
    "motivo_perda não pode mudar ao editar"
  );
  assert.equal(depois[0].telefone, "34988880000", "o campo que o formulário manda tem que salvar");
});

test("editar (UPDATE do repositório, sem etapa/motivo_perda) não mexe em etapa nem motivo_perda — oportunidade Perdida", async () => {
  const { rows } = await pool.query(
    `insert into oportunidades (cliente_nome, etapa, motivo_perda)
     values ('João Perdido', 'perdido', 'Comprou em outra loja')
     returning id`
  );
  const id = rows[0].id;

  await pool.query(UPDATE, params(id, { cliente_nome: "João Perdido" }));

  const { rows: depois } = await pool.query(
    `select etapa, motivo_perda from oportunidades where id = $1`,
    [id]
  );
  assert.equal(depois[0].etapa, "perdido", "etapa não pode mudar ao editar");
  assert.equal(depois[0].motivo_perda, "Comprou em outra loja", "motivo_perda não pode ser apagado ao editar");
});
