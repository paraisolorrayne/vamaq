/**
 * A EMISSÃO da devolução de nota — o que grava no banco e o que ela destrava.
 *
 * Os testes puros (fiscal-devolucao-nota) provam o payload. Aqui é o resto,
 * que é onde os defeitos deste módulo moraram até hoje: o INSERT, a busca do
 * XML, e as guardas de "este veículo já tem nota" — que, se não souberem da
 * devolução, deixam a Mayra com a devolução autorizada e a nota nova travada.
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
import { xmlVenda, xmlEntrada, CHAVE_VENDA, CHAVE_ENTRADA_ESCRITORIO } from "./helpers/xml-nfe.mjs";
import { veiculosSemEntrada } from "../src/lib/fiscal/entradaPendente.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADMIN_URL =
  process.env.TEST_ADMIN_URL || "postgres://postgres@localhost:5432/postgres";
const TEST_DB = "vamaq_devolucao_nota_test";
const XML_URL = "https://api.focusnfe.com.br/arquivos/venda.xml";

let pool;
let notas;
let vehicleId;
let chamadas;
let xmlServido;
let respostaEmissao;
const fetchReal = globalThis.fetch;

const COMPRADORA = {
  nome: "Maria Compradora", doc: "52998224725", cep: "38400100",
  logradouro: "Rua das Flores", numero: "100", bairro: "Centro",
  municipio: "Uberlandia", uf: "MG",
};

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
    "auth-schema.sql",
    "documentos-schema.sql",
    "fiscal-schema.sql",
    // emitirNotaVeiculo grava cliente_id — o teste da nota nova passa por ele.
    "clientes-schema.sql",
    "fiscal-entrada.sql",
    "fiscal-consignacao-devolucao.sql",
    "fiscal-natop-60.sql",
    "estoque-ciclo.sql",
    "fiscal-devolucao-nota.sql",
  ]) {
    await pool.query(await readFile(path.join(ROOT, "db", f), "utf8"));
  }

  const v = await pool.query(
    `insert into vehicles (slug, brand, model, year, price, status, chassi, placa)
     values ('cayenne-teste','Porsche','Cayenne',2016,330000,'vendido',
             'WP1AA2923GKA14408','PAS4I58')
     returning id`
  );
  vehicleId = v.rows[0].id;
  await pool.query(
    `insert into fiscal_config (cnpj, cfop, cst, ncm, serie)
     values ('45348469000154','5102','20','87032100','2')`
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
  await pool.query(`delete from notas_fiscais where ref_devolvida is not null`);
  await pool.query(`delete from notas_fiscais`);
  chamadas = [];
  xmlServido = xmlVenda();
  respostaEmissao = { status: "processando_autorizacao" };
  globalThis.fetch = async (url, opts = {}) => {
    chamadas.push({ url: String(url), method: opts.method || "GET", body: opts.body });
    if (String(url) === XML_URL) {
      return new Response(xmlServido, { status: 200, headers: { "content-type": "application/xml" } });
    }
    return new Response(JSON.stringify(respostaEmissao), {
      status: 202,
      headers: { "content-type": "application/json" },
    });
  };
});

async function venda({ status = "autorizada", ref = "vamaq-venda" } = {}) {
  await pool.query(
    `insert into notas_fiscais (ref, vehicle_id, status, valor, destinatario, serie, operacao, cfop, chave, numero, xml_url)
     values ($1,$2,$3,330000,$4::jsonb,'2','saida','5102',$5,'1',$6)`,
    [ref, vehicleId, status, JSON.stringify(COMPRADORA), `NFe${CHAVE_VENDA}`, XML_URL]
  );
  return ref;
}

async function devolucoes() {
  const { rows } = await pool.query(
    `select ref, operacao, cfop, status, valor, destinatario, serie, ref_devolvida, chave_referenciada
       from notas_fiscais where operacao = 'devolucao' order by created_at`
  );
  return rows;
}

// ── nota do sistema ─────────────────────────────────────────────────────────

test("devolver a venda do sistema grava a devolução 1202 ligada à venda", async () => {
  const ref = await venda();
  const res = await notas.devolverNota(ref);
  assert.equal(res.error, undefined, res.error);

  const [d] = await devolucoes();
  assert.equal(d.cfop, "1202");
  assert.equal(d.status, "processando");
  assert.equal(Number(d.valor), 330000);
  assert.equal(d.serie, "2");
  assert.equal(d.ref_devolvida, ref);
  assert.equal(d.chave_referenciada, CHAVE_VENDA);
  assert.equal(d.destinatario.nome, "Maria Compradora");

  // Primeiro o XML da venda, depois a emissão — com finalidade 4.
  assert.equal(chamadas[0].url, XML_URL);
  const emissao = chamadas.find((c) => c.method === "POST");
  const payload = JSON.parse(emissao.body);
  assert.equal(payload.finalidade_emissao, 4);
  assert.equal(payload.items[0].icms_valor, 785.77);
});

test("só nota autorizada se devolve", async () => {
  const ref = await venda({ status: "erro" });
  const res = await notas.devolverNota(ref);
  assert.match(res.error, /autorizada/i);
  assert.equal((await devolucoes()).length, 0);
});

test("a mesma nota não é devolvida duas vezes", async () => {
  const ref = await venda();
  await notas.devolverNota(ref);
  const res = await notas.devolverNota(ref);
  assert.match(res.error, /já foi enviada|já foi devolvida/i);
  assert.equal((await devolucoes()).length, 1);
});

test("a Focus recusando, a devolução fica como erro e pode ser tentada de novo", async () => {
  const ref = await venda();
  globalThis.fetch = async (url) =>
    String(url) === XML_URL
      ? new Response(xmlServido, { status: 200 })
      : new Response(JSON.stringify({ mensagem: "Rejeicao: teste" }), { status: 422 });
  const res = await notas.devolverNota(ref);
  assert.match(res.error, /Rejeicao/);
  assert.equal((await devolucoes())[0].status, "erro");

  globalThis.fetch = async (url) =>
    String(url) === XML_URL
      ? new Response(xmlServido, { status: 200 })
      : new Response(JSON.stringify({ status: "processando_autorizacao" }), { status: 202 });
  const deNovo = await notas.devolverNota(ref);
  assert.equal(deNovo.error, undefined, deNovo.error);
});

// ── o que a devolução destrava ──────────────────────────────────────────────

test("venda com devolução AUTORIZADA libera a nota nova do mesmo carro", async () => {
  const ref = await venda();
  await notas.devolverNota(ref);
  await pool.query(`update notas_fiscais set status='autorizada' where operacao='devolucao'`);

  const dados = await notas.getDadosEmissao(vehicleId);
  assert.equal(dados.notaExistente, null, "a tela de emissão ainda acha que há nota");

  const res = await notas.emitirNotaVeiculo(vehicleId, {
    destinatario: COMPRADORA, valorVenda: 300000, custoAquisicao: 160000, numeroNotaEntrada: "20",
  });
  assert.doesNotMatch(String(res.error || ""), /já tem nota|sendo autorizada/i);
});

test("devolução ainda em processamento NÃO libera — ela pode ser recusada", async () => {
  const ref = await venda();
  await notas.devolverNota(ref);
  const res = await notas.emitirNotaVeiculo(vehicleId, {
    destinatario: COMPRADORA, valorVenda: 300000, custoAquisicao: 160000, numeroNotaEntrada: "20",
  });
  assert.match(res.error, /já tem nota/i);
});

test("entrada devolvida deixa de ser 'a entrada do carro' e pode ser refeita", async () => {
  await pool.query(
    `insert into notas_fiscais (ref, vehicle_id, status, valor, destinatario, serie, operacao, cfop, chave, numero, xml_url)
     values ('vamaq-ent',$1,'autorizada',160000,$2::jsonb,'2','entrada','1102',$3,'20',$4)`,
    [vehicleId, JSON.stringify(COMPRADORA), `NFe${CHAVE_ENTRADA_ESCRITORIO}`, XML_URL]
  );
  xmlServido = xmlEntrada();
  const res = await notas.devolverNota("vamaq-ent");
  assert.equal(res.error, undefined, res.error);
  assert.equal((await devolucoes())[0].cfop, "5202");
  await pool.query(`update notas_fiscais set status='autorizada' where operacao='devolucao'`);

  const v = (await pool.query(`select ciclo from vehicles where id=$1`, [vehicleId])).rows[0];
  assert.equal(await notas.notaEntradaAtiva(vehicleId, v.ciclo), null);
  assert.equal((await notas.getDadosEmissao(vehicleId)).numeroNotaEntrada, "");
  assert.equal(
    veiculosSemEntrada([{ id: vehicleId, ciclo: v.ciclo }], await notas.listNotas()).length,
    1,
    "o carro tem que voltar para o seletor de entrada"
  );
  const refazer = await notas.dadosParaRefazer("vamaq-ent");
  assert.equal(refazer?.contraparte.nome, "Maria Compradora");
});

test("a lista de notas diz que a nota foi devolvida", async () => {
  const ref = await venda();
  await notas.devolverNota(ref);
  const original = (await notas.listNotas()).find((n) => n.ref === ref);
  assert.equal(original.devolucao_status, "processando");
});

// ── nota do escritório (XML enviado) ────────────────────────────────────────

test("a entrada do escritório é devolvida pelo XML, sem existir no sistema", async () => {
  const res = await notas.devolverNotaPorXml(vehicleId, xmlEntrada());
  assert.equal(res.error, undefined, res.error);
  const [d] = await devolucoes();
  assert.equal(d.cfop, "5202");
  assert.equal(d.ref_devolvida, null);
  assert.equal(d.chave_referenciada, CHAVE_ENTRADA_ESCRITORIO);
  assert.equal(d.destinatario.nome, "Joao Vendedor");
});

test("XML de uma nota que está no sistema liga a devolução a ela", async () => {
  const ref = await venda();
  await notas.devolverNotaPorXml(vehicleId, xmlVenda());
  assert.equal((await devolucoes())[0].ref_devolvida, ref);
});

test("o mesmo XML do escritório não é devolvido duas vezes", async () => {
  await notas.devolverNotaPorXml(vehicleId, xmlEntrada());
  const res = await notas.devolverNotaPorXml(vehicleId, xmlEntrada());
  assert.match(res.error, /já foi enviada|já foi devolvida/i);
});

test("XML inválido é recusado antes de gravar", async () => {
  const res = await notas.devolverNotaPorXml(vehicleId, "<html/>");
  assert.match(res.error, /XML/);
  assert.equal((await devolucoes()).length, 0);
});

// ── a devolução de consignação continua separada ────────────────────────────

test("devolução de VENDA não fecha a consignação do mesmo carro", async () => {
  await pool.query(
    `insert into notas_fiscais (ref, vehicle_id, status, valor, destinatario, serie, operacao, cfop, chave)
     values ('vamaq-cons',$1,'autorizada',160000,$2::jsonb,'2','entrada','1917',
             'NFe31260845348469000154550020000000141000000149')`,
    [vehicleId, JSON.stringify(COMPRADORA)]
  );
  await notas.devolverNota(await venda());
  await pool.query(`update notas_fiscais set status='autorizada' where operacao='devolucao'`);

  const abertas = await notas.listConsignacoesAbertas();
  assert.equal(abertas.length, 1, "a consignação sumiu da lista por causa da devolução de venda");
  const res = await notas.devolverConsignacaoVeiculo(vehicleId);
  assert.doesNotMatch(String(res.error || ""), /já foi devolvido/i);
});
