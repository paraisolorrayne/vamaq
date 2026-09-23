/**
 * Gravar o contrato cadastra o cliente que está nele.
 *
 * O DEFEITO (21/09/2026): o contrato só se ligava a um cliente quando alguém
 * tinha ESCOLHIDO um no seletor do topo da tela. Cadastrar a partir do que foi
 * digitado dependia de um botão opcional, "Salvar como cliente", que fica
 * ACIMA do formulário — para usá-lo era preciso preencher a minuta, voltar ao
 * topo e clicar. Ninguém volta. O contrato digitado à mão era gravado com
 * `cliente_id` nulo: sem cliente, sem vínculo com o carro, sem aviso. A ficha
 * de clientes ficava vazia enquanto os contratos se acumulavam.
 *
 * Agora quem decide é o servidor, na gravação: acha o cliente pelo CPF/CNPJ
 * do contrato ou cadastra um novo, e liga ao veículo.
 *
 *   npm test   (usa TEST_ADMIN_URL, default postgres@localhost)
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./tests/helpers/mock-session-loader.mjs", pathToFileURL("./"));

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADMIN_URL =
  process.env.TEST_ADMIN_URL || "postgres://postgres@localhost:5432/postgres";
const TEST_DB = "vamaq_contrato_cliente_test";

let pool;
let lib;
let vehicleId;

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
    "clientes-schema.sql",
    "assinatura-schema.sql",
    "documentos-dados.sql",
  ]) {
    await pool.query(await readFile(path.join(ROOT, "db", f), "utf8"));
  }
  const v = await pool.query(
    `insert into vehicles (slug, brand, model, year) values ('teste-contrato-cliente','Porsche','911',2019) returning id`
  );
  vehicleId = v.rows[0].id;

  process.env.DATABASE_URL = url;
  lib = await import("@/lib/documentos");
});

after(async () => {
  const { getPool } = await import("@/lib/db");
  await getPool()?.end();
  await pool?.end();
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.end();
});

const COMPRADOR = {
  comprador_nome: "Maria Souza",
  comprador_cpf: "529.982.247-25",
  comprador_cnh: "01234567890",
  comprador_cnh_categoria: "B",
  comprador_endereco: "Rua das Flores, 120, Centro, Uberlândia/MG",
  comprador_telefone: "(34) 99999-0000",
  comprador_email: "Maria@Exemplo.com",
};

async function gravar(extra = {}) {
  const res = await lib.salvarDocumento({
    tipo: "venda",
    titulo: "Contrato de Venda",
    cliente: "Maria Souza",
    vehicleId,
    buffer: Buffer.from("%PDF-1.4 fake"),
    dados: COMPRADOR,
    ...extra,
  });
  assert.equal(res.error, undefined, res.error);
  return res.documento;
}

test("contrato digitado à mão cadastra o cliente, com os dados do contrato", async () => {
  const doc = await gravar();
  assert.ok(doc.cliente_id, "o contrato ficou sem cliente");

  const { rows } = await pool.query(`select * from clientes where id = $1`, [doc.cliente_id]);
  assert.equal(rows[0].nome, "Maria Souza");
  assert.equal(rows[0].doc, "52998224725");
  assert.equal(rows[0].cnh, "01234567890");
  assert.equal(rows[0].telefone, "(34) 99999-0000");
  assert.equal(rows[0].email, "maria@exemplo.com");
  // O contrato traz o endereço numa linha só; o cadastro tem campos separados
  // (a NF-e lê logradouro/município/UF). Adivinhar a quebra estragaria a nota,
  // então a linha vai para a observação, onde ninguém a toma por estruturada.
  assert.equal(rows[0].logradouro, null);
  assert.match(rows[0].obs, /Rua das Flores, 120/);
});

test("o cliente cadastrado pelo contrato fica ligado ao carro", async () => {
  const doc = await gravar();
  const { rows } = await pool.query(
    `select papel, origem, documento_id from cliente_veiculos where cliente_id = $1 and vehicle_id = $2`,
    [doc.cliente_id, vehicleId]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].papel, "comprou");
  assert.equal(rows[0].origem, "contrato");
});

test("segundo contrato do mesmo CPF reaproveita o cliente, não duplica", async () => {
  const a = await gravar();
  const b = await gravar({ dados: { ...COMPRADOR, comprador_cpf: "52998224725" } });
  assert.equal(a.cliente_id, b.cliente_id);
  const { rows } = await pool.query(`select count(*)::int n from clientes where doc = '52998224725'`);
  assert.equal(rows[0].n, 1);
});

test("cliente escolhido no seletor vale mais que o digitado", async () => {
  const { rows } = await pool.query(
    `insert into clientes (nome, tipo, doc) values ('João Escolhido','pf','11144477735') returning id`
  );
  const doc = await gravar({ clienteId: rows[0].id });
  assert.equal(doc.cliente_id, rows[0].id);
});

test("sem CPF/CNPJ não cadastra — nome sozinho vira homônimo duplicado", async () => {
  const antes = await pool.query(`select count(*)::int n from clientes`);
  const doc = await gravar({ dados: { comprador_nome: "Fulano Sem Documento" } });
  assert.equal(doc.cliente_id, null);
  const depois = await pool.query(`select count(*)::int n from clientes`);
  assert.equal(depois.rows[0].n, antes.rows[0].n);
});

test("CPF malformado não derruba a gravação do contrato", async () => {
  const doc = await gravar({ dados: { ...COMPRADOR, comprador_cpf: "123" } });
  assert.ok(doc.id);
  assert.equal(doc.cliente_id, null);
});
