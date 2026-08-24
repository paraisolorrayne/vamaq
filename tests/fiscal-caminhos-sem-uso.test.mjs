/**
 * Os caminhos do módulo fiscal que ninguém tinha percorrido ainda.
 *
 * POR QUE ESTE ARQUIVO: em três dias, três defeitos com o mesmo formato — um
 * INSERT sem uma coluna, um endereço de API que não existia, e uma
 * funcionalidade inteira ausente. Nenhum aparecia em build, lint ou teste,
 * porque nenhum teste percorria o caminho REAL: banco de verdade e resposta
 * de verdade da API. Os três só quebraram quando a Mayra precisou deles pela
 * primeira vez, em produção, com nota errada na mão.
 *
 * O antídoto não é escrever mais teste de payload — esses já existiam e
 * passavam. É percorrer o caminho inteiro de cada função que grava ou fala com
 * a Focus, ANTES de alguém precisar dela.
 *
 * Aqui ficam as que faltavam, priorizadas por risco: `cancelarNota` e
 * `emitirCartaCorrecao` (a Mayra vai usar agora, por causa da NF 17) e
 * `listConsignacoesAbertas` (alimenta o botão de devolver ao dono, que nunca
 * foi clicado — o mesmo perfil dos três anteriores).
 *
 * A rede é substituída, não chamada.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./tests/helpers/mock-session-loader.mjs", pathToFileURL("./"));

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADMIN_URL =
  process.env.TEST_ADMIN_URL || "postgres://postgres@localhost:5432/postgres";
const TEST_DB = "vamaq_fiscal_caminhos_test";

let pool;
let notas;
let vehicleId;
let respostaFocus;
const fetchReal = globalThis.fetch;

before(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const u = new URL(ADMIN_URL);
  const url = `${u.protocol}//${u.username || "postgres"}@${u.hostname}:${u.port || 5432}/${TEST_DB}`;
  pool = new pg.Pool({ connectionString: url });
  for (const f of [
    "schema.sql",
    "fiscal-schema.sql",
    "fiscal-entrada.sql",
    "fiscal-consignacao-devolucao.sql",
    "fiscal-natop-60.sql",
    "fiscal-cfop-interestadual.sql",
    "fiscal-carta-correcao.sql",
  ]) {
    await pool.query(await readFile(path.join(ROOT, "db", f), "utf8"));
  }

  const v = await pool.query(
    `insert into vehicles (slug, brand, model, year, price, status, chassi, placa)
     values ('q5-teste','Audi','Q5',2025,400000,'disponivel','WAUBKDGU1S2109915','TYK6D39')
     returning id`
  );
  vehicleId = v.rows[0].id;
  await pool.query(
    `insert into fiscal_config (cnpj, cfop, cst, ncm, serie)
     values ('45348469000154','5102','020','87032100','2')`
  );

  process.env.FOCUS_NFE_TOKEN = "token-de-teste";
  process.env.DATABASE_URL = url;
  notas = await import("@/lib/fiscal/notas");
});

after(async () => {
  globalThis.fetch = fetchReal;
  const { getPool } = await import("@/lib/db");
  await getPool()?.end();
  await pool?.end();
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.end();
});

beforeEach(async () => {
  await pool.query(`delete from notas_fiscais`);
  respostaFocus = { ok: true, corpo: { status: "cancelado" } };
  globalThis.fetch = async () =>
    new Response(JSON.stringify(respostaFocus.corpo), {
      status: respostaFocus.ok ? 200 : 404,
      headers: { "content-type": "application/json" },
    });
});

async function nota(status = "autorizada", extra = {}) {
  const { operacao = "saida", cfop = "5102", numero = "17" } = extra;
  await pool.query(
    `insert into notas_fiscais (ref, vehicle_id, status, valor, serie, operacao, cfop, numero, destinatario)
     values ('vamaq-r1',$1,$2,400000,'2',$3,$4,$5,$6::jsonb)`,
    [
      vehicleId, status, operacao, cfop, numero,
      // Consignante COMPLETO: é o que a entrada grava de verdade, e é dele
      // que a devolução reaproveita o endereço sem redigitar.
      JSON.stringify({
        nome: "Henrique Andrade", doc: "803.582.841-04", cep: "75.707-090",
        logradouro: "Rua Maria Esmeraldina da Silva", numero: "65",
        bairro: "Lago das Mansoes", municipio: "Catalão", uf: "GO",
      }),
    ]
  );
  return "vamaq-r1";
}

// ── cancelarNota ───────────────────────────────────────────────────────────

test("cancelar grava o status, a justificativa e a data", async () => {
  const ref = await nota();
  const res = await notas.cancelarNota(ref, "Nota emitida com CFOP incorreto para o estado");
  assert.equal(res.error, undefined, res.error);

  const { rows } = await pool.query(`select * from notas_fiscais where ref=$1`, [ref]);
  assert.equal(rows[0].status, "cancelada");
  assert.match(rows[0].justificativa_cancelamento, /CFOP incorreto/);
  assert.ok(rows[0].cancelada_em, "cancelada_em precisa ser preenchida");
});

test("justificativa curta para antes de falar com a SEFAZ", async () => {
  const ref = await nota();
  const res = await notas.cancelarNota(ref, "Errei");
  assert.match(res.error, /15 caracteres/);
  const { rows } = await pool.query(`select status from notas_fiscais where ref=$1`, [ref]);
  assert.equal(rows[0].status, "autorizada", "a nota não pode mudar de estado");
});

test("recusa da SEFAZ não marca a nota como cancelada", async () => {
  // O caso do prazo vencido: a nota continua valendo, e a tela precisa
  // continuar mostrando isso.
  const ref = await nota();
  respostaFocus = { ok: false, corpo: { mensagem: "Prazo de cancelamento expirado" } };
  const res = await notas.cancelarNota(ref, "Nota emitida com CFOP incorreto para o estado");
  assert.match(res.error, /Prazo de cancelamento expirado/);
  const { rows } = await pool.query(`select status from notas_fiscais where ref=$1`, [ref]);
  assert.equal(rows[0].status, "autorizada");
});

// ── emitirCartaCorrecao ────────────────────────────────────────────────────

test("carta de correção guarda o texto, a data e conta as correções", async () => {
  const ref = await nota();
  respostaFocus = { ok: true, corpo: { status: "registrado" } };
  const texto = "CFOP correto para operacao interestadual: 2917";

  await notas.emitirCartaCorrecao(ref, texto);
  let { rows } = await pool.query(`select * from notas_fiscais where ref=$1`, [ref]);
  assert.equal(rows[0].carta_correcao, texto);
  assert.ok(rows[0].carta_correcao_em);
  assert.equal(rows[0].carta_correcao_qtd, 1);

  // A SEFAZ aceita até 20 e vale sempre a última.
  await notas.emitirCartaCorrecao(ref, "Segunda correcao do mesmo documento fiscal");
  ({ rows } = await pool.query(`select * from notas_fiscais where ref=$1`, [ref]));
  assert.match(rows[0].carta_correcao, /Segunda correcao/);
  assert.equal(rows[0].carta_correcao_qtd, 2);
});

test("carta de correção só vale em nota autorizada", async () => {
  for (const [status, esperado] of [
    ["erro", /só vale para nota autorizada/i],
    ["cancelada", /foi cancelada/i],
    ["processando", /só vale para nota autorizada/i],
  ]) {
    await pool.query(`delete from notas_fiscais`);
    const ref = await nota(status);
    const res = await notas.emitirCartaCorrecao(ref, "Texto de correcao com tamanho suficiente");
    assert.match(res.error, esperado, `status ${status}`);
  }
});

test("nota inexistente devolve erro, não estoura", async () => {
  const res = await notas.emitirCartaCorrecao("nao-existe", "Texto de correcao com tamanho ok");
  assert.match(res.error, /não encontrada/i);
});

// ── listConsignacoesAbertas ────────────────────────────────────────────────

test("lista só consignação autorizada e ainda não devolvida", async () => {
  // Uma consignação viva.
  await nota("autorizada", { operacao: "entrada", cfop: "1917" });
  let abertas = await notas.listConsignacoesAbertas();
  assert.equal(abertas.length, 1);
  assert.equal(abertas[0].vehicle_id, vehicleId);
  assert.equal(abertas[0].valor, 400000, "o valor volta como número, para a devolução reusar");
  assert.equal(abertas[0].destinatario.nome, "Henrique Andrade");

  // Devolvida: sai da lista.
  await pool.query(
    `insert into notas_fiscais (ref, vehicle_id, status, valor, serie, operacao, cfop)
     values ('vamaq-dev',$1,'autorizada',400000,'2','devolucao','5918')`,
    [vehicleId]
  );
  abertas = await notas.listConsignacoesAbertas();
  assert.equal(abertas.length, 0, "carro devolvido não pode continuar oferecendo devolução");
});

test("compra não entra na lista de consignações — é o CFOP que separa", async () => {
  await nota("autorizada", { operacao: "entrada", cfop: "1102" });
  assert.equal((await notas.listConsignacoesAbertas()).length, 0);
});

test("consignação interestadual (2917) também deveria poder ser devolvida", async () => {
  // A NF 17 é 2917. Se a lista filtra só por 1917, esse carro nunca aparece
  // para devolver — e ninguém descobre até precisar.
  await nota("autorizada", { operacao: "entrada", cfop: "2917" });
  const abertas = await notas.listConsignacoesAbertas();
  assert.equal(abertas.length, 1, "consignação de outro estado ficou de fora da lista");
});

test("devolver funciona para consignação de outro estado, e sai com 6918", async () => {
  // A ponta seguinte do mesmo defeito: se a lista mostra o carro mas a
  // devolução não o encontra, o botão aparece e não faz nada.
  await nota("autorizada", { operacao: "entrada", cfop: "2917" });
  respostaFocus = { ok: false, corpo: { mensagem: "Focus indisponivel no teste" } };
  await notas.devolverConsignacaoVeiculo(vehicleId);

  const { rows } = await pool.query(
    `select cfop, valor from notas_fiscais where operacao='devolucao'`
  );
  assert.equal(rows.length, 1, "a devolução tinha que ter sido gravada");
  assert.equal(rows[0].cfop, "6918", "consignante de outro estado devolve com 6918");
});
