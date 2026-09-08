/**
 * Recorte do mês no fechamento fiscal, contra Postgres real.
 *
 * O QUE ESTÁ EM JOGO é o mesmo de fiscal-notas-do-mes.test.mjs: `created_at` é
 * timestamptz, o servidor roda em Europe/Berlin e a loja vive em São Paulo. A
 * nota das 23h30 do dia 31 já é dia 1º em Berlim. No pacote de XMLs isso
 * mandaria a nota no zip errado; aqui é pior — o TOTAL que o contador usa para
 * fechar o mês sai errado, e ninguém tem como conferir sem abrir nota por nota,
 * que é exatamente o trabalho que este relatório veio eliminar.
 *
 * Os testes puros (fiscal-fechamento.test.mjs) provam a classificação; este
 * prova que a query realmente roda e traz as notas certas.
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

import { SQL_TOTAIS_DO_MES, resumirNotas } from "../src/lib/fiscal/fechamento.js";
import { OPCOES_CONEXAO } from "../src/lib/pgTypes.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADMIN_URL =
  process.env.TEST_ADMIN_URL || "postgres://postgres@localhost:5432/postgres";
const TEST_DB = "vamaq_totais_mes_test";

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
    ...OPCOES_CONEXAO,
  });
  // fiscal-consignacao-devolucao.sql é obrigatório aqui: é ele que cria a
  // coluna `cfop` — a única coisa que separa compra de consignação — e que
  // libera `operacao = 'devolucao'` no check.
  for (const file of [
    "schema.sql",
    "fiscal-schema.sql",
    "fiscal-entrada.sql",
    "fiscal-consignacao-devolucao.sql",
  ]) {
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

async function nota({
  ref,
  operacao = "saida",
  cfop = "5102",
  status = "autorizada",
  valor,
  emitidaEm,
  xml = "http://x/a.xml",
}) {
  await pool.query(
    `insert into notas_fiscais (ref, vehicle_id, status, operacao, cfop, valor, xml_url, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [ref, veiculo, status, operacao, cfop, valor, xml, emitidaEm]
  );
}

/** O resumo do mês como a rota o monta: query + função pura. */
async function fechamento(ano, mes) {
  const { rows } = await pool.query(SQL_TOTAIS_DO_MES, [ano, mes]);
  return resumirNotas(rows);
}

function valorDe(resumo, chave) {
  return resumo.linhas.find((l) => l.chave === chave).valor;
}

test("nota das 23h30 do último dia conta no mês dela, não no seguinte", async () => {
  // 31/08/2026 23:30 em São Paulo — que em UTC (e em Berlim) já é 01/09.
  await nota({ ref: "fim-de-agosto", valor: 100000, emitidaEm: "2026-08-31T23:30:00-03:00" });
  await nota({ ref: "inicio-de-setembro", valor: 7000, emitidaEm: "2026-09-01T00:30:00-03:00" });

  assert.equal(valorDe(await fechamento(2026, 8), "venda"), 100000);
  assert.equal(valorDe(await fechamento(2026, 9), "venda"), 7000);
});

test("compra e consignação do mesmo mês caem em linhas diferentes", async () => {
  await nota({
    ref: "compra-set",
    operacao: "entrada",
    cfop: "1102",
    valor: 80000,
    emitidaEm: "2026-09-10T10:00:00-03:00",
  });
  await nota({
    ref: "consignacao-set",
    operacao: "entrada",
    cfop: "1917",
    valor: 60000,
    emitidaEm: "2026-09-11T10:00:00-03:00",
  });

  const r = await fechamento(2026, 9);
  assert.equal(valorDe(r, "compra"), 80000);
  assert.equal(valorDe(r, "consignacao"), 60000);
});

test("nota sem XML entra no total — ela foi emitida, mesmo sem arquivo baixado", async () => {
  // Aqui o fechamento DIVERGE do pacote de XMLs de propósito: lá, sem arquivo
  // não há o que zipar; aqui, a nota existe e conta.
  await nota({
    ref: "autorizada-sem-xml",
    valor: 33000,
    xml: null,
    emitidaEm: "2026-10-05T10:00:00-03:00",
  });

  assert.equal(valorDe(await fechamento(2026, 10), "venda"), 33000);
});

test("cancelada do mês é contada no aviso e fica fora do total", async () => {
  await nota({ ref: "boa-nov", valor: 50000, emitidaEm: "2026-11-05T10:00:00-03:00" });
  await nota({
    ref: "cancelada-nov",
    status: "cancelada",
    valor: 90000,
    emitidaEm: "2026-11-06T10:00:00-03:00",
  });

  const r = await fechamento(2026, 11);
  assert.equal(valorDe(r, "venda"), 50000);
  assert.equal(r.canceladas, 1);
});

test("mês sem nota nenhuma devolve o resumo zerado, não um erro", async () => {
  const r = await fechamento(2019, 3);

  assert.equal(valorDe(r, "venda"), 0);
  assert.equal(valorDe(r, "compra"), 0);
  assert.equal(r.canceladas, 0);
});
