/**
 * As guardas fiscais são por CICLO, não por veículo.
 *
 * Um carro que a Vamaq vendeu e recebeu de volta na troca é uma nova aquisição:
 * nota de entrada própria e nota de venda própria. Sem o ciclo, as guardas de
 * notas.js respondem "este veículo já tem nota de entrada autorizada" e a
 * segunda negociação inteira trava.
 *
 * O teste mais importante é o do NÚMERO DA ENTRADA: o texto obrigatório da nota
 * de venda cita o número da nota de entrada do veículo. Sem filtro por ciclo, a
 * segunda venda sairia autorizada citando a compra de meses atrás, de outro
 * vendedor — erro silencioso, em documento fiscal.
 *
 *   npm test   (usa TEST_ADMIN_URL, default postgres@localhost)
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// notas.js importa "@/lib/..." — alias que só existe para o webpack do Next.
// Sem este loader (mesmo usado por tests/fin-ciclo-margem.test.mjs, que
// também importa notas.js), o import abaixo estoura ERR_MODULE_NOT_FOUND.
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
const TEST_DB = "vamaq_fiscal_ciclo_test";

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
  process.env.DATABASE_URL = urlFor(su);
  pool = new pg.Pool({ connectionString: urlFor(su) });
  // fiscal-entrada.sql é obrigatório e não opcional: é ele quem cria
  // notas_fiscais.operacao, e o índice/guarda por ciclo de estoque-ciclo.sql
  // é sobre (vehicle_id, operacao, ciclo). Sem ele nada aqui funciona.
  //
  // fiscal-consignacao-devolucao.sql entrou no fix round 1 (item 2 da
  // revisão): sem ele, `notas_fiscais.cfop` não existe (devolverConsignacaoVeiculo
  // usa) e `operacao='devolucao'` estoura a check constraint (só 'saida' e
  // 'entrada' eram permitidos antes deste arquivo).
  for (const file of [
    "schema.sql",
    "auth-schema.sql",
    "fiscal-schema.sql",
    "fiscal-entrada.sql",
    "fiscal-consignacao-devolucao.sql",
    "estoque-ciclo.sql",
  ]) {
    await pool.query(await readFile(path.join(ROOT, "db", file), "utf8"));
  }
  await pool.query(
    `insert into fiscal_config (cnpj) values ('45348469000154')
       on conflict do nothing`
  );

  // Token de mentira só para passar por focusEnabled(): os testes abaixo das
  // guardas de emitirNotaVeiculo/emitirNotaEntradaVeiculo/devolverConsignacaoVeiculo
  // param ANTES de qualquer chamada de rede (num erro de validação anterior ao
  // envio), então não precisam de fetch mockado — mas passam pelo focusEnabled()
  // primeiro, que é a própria checagem do token.
  process.env.FOCUS_NFE_TOKEN = "token-de-teste";
});

after(async () => {
  // notas.js lê via query() de @/lib/db, que abre o SEU PRÓPRIO pool de nível
  // de módulo. Sem fechá-lo, o DROP DATABASE abaixo trava esperando ele soltar
  // a conexão, e o `node --test` nunca termina (mesmo padrão de
  // tests/estoque-retorno-store.test.mjs).
  const { getPool } = await import("@/lib/db");
  await getPool()?.end();
  await pool?.end();
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.end();
});

const {
  getDadosEmissao,
  notaEntradaAtiva,
  emitirNotaVeiculo,
  emitirNotaEntradaVeiculo,
  devolverConsignacaoVeiculo,
} = await import("../src/lib/fiscal/notas.js");

async function novoVeiculo(slug) {
  const { rows } = await pool.query(
    `insert into vehicles (slug, brand, model, year, price, status)
     values ($1,'Audi','Q5',2022,200000,'vendido') returning id`,
    [slug]
  );
  return rows[0].id;
}

async function nota(vehicleId, { ref, operacao, numero, status = "autorizada" }) {
  await pool.query(
    `insert into notas_fiscais (ref, vehicle_id, status, valor, operacao, numero)
     values ($1,$2,$3,200000,$4,$5)`,
    [ref, vehicleId, status, operacao, numero]
  );
}

test("no ciclo 1, a nota de saída existente segue bloqueando — como hoje", async () => {
  const id = await novoVeiculo("q5-fiscal-ciclo1");
  await nota(id, { ref: "saida-c1", operacao: "saida", numero: "11" });

  const dados = await getDadosEmissao(id);
  assert.ok(dados.notaExistente, "a guarda do ciclo corrente tem que continuar valendo");
});

test("a nota de saída do ciclo 1 não bloqueia a venda do ciclo 2", async () => {
  const id = await novoVeiculo("q5-fiscal-saida-c2");
  await nota(id, { ref: "saida-antiga", operacao: "saida", numero: "11" });
  await pool.query(`update vehicles set ciclo = 2 where id = $1`, [id]);

  const dados = await getDadosEmissao(id);
  assert.equal(dados.notaExistente, null, "a venda do ciclo novo não pode ver a nota do ciclo velho");
});

test("a nota de venda do ciclo 2 cita a entrada DO CICLO 2", async () => {
  const id = await novoVeiculo("q5-fiscal-numero");
  await nota(id, { ref: "entrada-c1", operacao: "entrada", numero: "10" });
  await pool.query(`update vehicles set ciclo = 2 where id = $1`, [id]);
  await nota(id, { ref: "entrada-c2", operacao: "entrada", numero: "27" });

  const dados = await getDadosEmissao(id);
  assert.equal(
    dados.numeroNotaEntrada,
    "27",
    "citar a entrada do ciclo velho põe a compra errada numa nota autorizada"
  );
});

test("no ciclo 1 o número da entrada continua sendo o do ciclo 1", async () => {
  const id = await novoVeiculo("q5-fiscal-numero-c1");
  await nota(id, { ref: "entrada-unica", operacao: "entrada", numero: "10" });

  const dados = await getDadosEmissao(id);
  assert.equal(dados.numeroNotaEntrada, "10");
});

test("getDadosEmissao devolve o ciclo do veículo", async () => {
  const id = await novoVeiculo("q5-fiscal-expoe-ciclo");
  await pool.query(`update vehicles set ciclo = 3 where id = $1`, [id]);

  const dados = await getDadosEmissao(id);
  assert.equal(dados.veiculo.ciclo, 3);
});

// ── Fix round 1 (revisão): as guardas que EMITEM, não só as que mostram ────
//
// Os testes acima cobrem getDadosEmissao — o que a TELA lê. Mas quem de fato
// BLOQUEIA a emissão são consultas separadas dentro de emitirNotaVeiculo,
// emitirNotaEntradaVeiculo e devolverConsignacaoVeiculo (o load-bearing
// insight desta task: a diferença entre "mostrar" e "travar"). Reverter o
// filtro de ciclo em qualquer uma delas deixava a suíte antiga verde — esta
// seção fecha esse buraco.
//
// Nenhum destes testes chama a Focus: cada cenário "não bloqueado" para
// propositalmente no PRÓXIMO erro de validação (falta de custo/valor/NCM),
// que é anterior a qualquer rede — não precisa mockar fetch.

test("notaEntradaAtiva: não enxerga a entrada de um ciclo diferente do informado", async () => {
  const id = await novoVeiculo("q5-fiscal-notaentradaativa-c2");
  await nota(id, { ref: "entrada-ativa-outro-ciclo", operacao: "entrada", numero: "10" });

  const ativa = await notaEntradaAtiva(id, 2);
  assert.equal(ativa, null, "a entrada nasceu no ciclo 1 — não pode aparecer para o ciclo 2");
});

test("notaEntradaAtiva: enxerga a entrada do MESMO ciclo — é o que a tela de entrada usa", async () => {
  const id = await novoVeiculo("q5-fiscal-notaentradaativa-c1");
  await nota(id, { ref: "entrada-ativa-mesmo-ciclo", operacao: "entrada", numero: "10" });

  const ativa = await notaEntradaAtiva(id, 1);
  assert.ok(ativa);
  assert.equal(ativa.ref, "entrada-ativa-mesmo-ciclo");
});

test("emitirNotaVeiculo: nota de saída autorizada do ciclo 1 NÃO bloqueia a EMISSÃO do ciclo 2", async () => {
  const id = await novoVeiculo("q5-fiscal-emitir-saida-c2");
  await nota(id, { ref: "saida-emitir-c1", operacao: "saida", numero: "11" });
  await pool.query(`update vehicles set ciclo = 2 where id = $1`, [id]);

  const res = await emitirNotaVeiculo(id, { destinatario: {}, valorVenda: 200000 });
  assert.doesNotMatch(
    res.error || "",
    /já tem nota|autorizada pela SEFAZ|cancele/i,
    "a guarda que EMITE (não só a que getDadosEmissao mostra) tem que respeitar o ciclo"
  );
  assert.match(
    res.error,
    /valor de aquisição/i,
    "sem custo de aquisição, o próximo passo tem que travar por outro motivo — prova que passou da guarda de ciclo"
  );
});

test("emitirNotaVeiculo: nota de saída autorizada do MESMO ciclo continua bloqueando a emissão", async () => {
  const id = await novoVeiculo("q5-fiscal-emitir-saida-c1");
  await nota(id, { ref: "saida-emitir-c1-bloqueia", operacao: "saida", numero: "11" });

  const res = await emitirNotaVeiculo(id, { destinatario: {}, valorVenda: 200000 });
  assert.match(res.error, /já tem nota|cancele/i);
});

test("emitirNotaEntradaVeiculo: entrada autorizada do ciclo 1 NÃO bloqueia a EMISSÃO da entrada do ciclo 2", async () => {
  const id = await novoVeiculo("q5-fiscal-emitir-entrada-c2");
  await nota(id, { ref: "entrada-emitir-c1", operacao: "entrada", numero: "10" });
  await pool.query(`update vehicles set ciclo = 2 where id = $1`, [id]);

  const res = await emitirNotaEntradaVeiculo(id, { remetente: {}, valorAquisicao: undefined });
  assert.doesNotMatch(
    res.error || "",
    /já tem nota de entrada|autorizada pela SEFAZ/i,
    "a guarda que EMITE a entrada tem que respeitar o ciclo, não só notaEntradaAtiva isolada"
  );
  assert.match(
    res.error,
    /valor pago pelo veículo/i,
    "sem valor de aquisição, o próximo passo tem que travar por outro motivo"
  );
});

test("emitirNotaEntradaVeiculo: entrada autorizada do MESMO ciclo continua bloqueando a emissão", async () => {
  const id = await novoVeiculo("q5-fiscal-emitir-entrada-c1");
  await nota(id, { ref: "entrada-emitir-c1-bloqueia", operacao: "entrada", numero: "10" });

  const res = await emitirNotaEntradaVeiculo(id, { remetente: {}, valorAquisicao: 100000 });
  assert.match(res.error, /já tem nota de entrada|cancele/i);
});

test("devolverConsignacaoVeiculo: entrada de consignação do ciclo 1 NÃO autoriza a devolução no ciclo 2", async () => {
  const id = await novoVeiculo("q5-fiscal-devolucao-c2");
  await nota(id, { ref: "consig-entrada-c1", operacao: "entrada", numero: "14" });
  await pool.query(`update notas_fiscais set cfop = '1917' where ref = 'consig-entrada-c1'`);
  await pool.query(`update vehicles set ciclo = 2 where id = $1`, [id]);

  const res = await devolverConsignacaoVeiculo(id);
  assert.match(
    res.error,
    /não tem nota de entrada de consignação/i,
    "a entrada de consignação de um ciclo não pode autorizar a devolução de outro"
  );
});

test("devolverConsignacaoVeiculo: devolução já registrada no MESMO ciclo continua bloqueando", async () => {
  const id = await novoVeiculo("q5-fiscal-devolucao-mesmo-ciclo");
  await nota(id, { ref: "consig-entrada-bloqueia", operacao: "entrada", numero: "14" });
  await pool.query(`update notas_fiscais set cfop = '1917' where ref = 'consig-entrada-bloqueia'`);
  await nota(id, { ref: "consig-devolucao-bloqueia", operacao: "devolucao", numero: null });

  const res = await devolverConsignacaoVeiculo(id);
  assert.match(res.error, /já foi devolvido/i);
});

test("devolverConsignacaoVeiculo: devolução do ciclo 1 NÃO bloqueia a devolução de uma consignação nova, do ciclo 2", async () => {
  const id = await novoVeiculo("q5-fiscal-devolucao-nao-bloqueia-c2");
  // Ciclo 1: consignação recebida e devolvida — encerrada de verdade.
  await nota(id, { ref: "consig-entrada-c1-fechada", operacao: "entrada", numero: "14" });
  await pool.query(`update notas_fiscais set cfop = '1917' where ref = 'consig-entrada-c1-fechada'`);
  await nota(id, { ref: "consig-devolucao-c1-fechada", operacao: "devolucao", numero: null });

  // Ciclo 2: consignação NOVA, ainda sem devolução.
  await pool.query(`update vehicles set ciclo = 2 where id = $1`, [id]);
  await nota(id, { ref: "consig-entrada-c2-nova", operacao: "entrada", numero: "22" });
  await pool.query(`update notas_fiscais set cfop = '1917' where ref = 'consig-entrada-c2-nova'`);

  const res = await devolverConsignacaoVeiculo(id);
  assert.doesNotMatch(
    res.error || "",
    /já foi devolvido|não tem nota de entrada/i,
    "a devolução do ciclo 1 não pode travar a devolução de uma consignação nova, do ciclo 2"
  );
  assert.match(
    res.error,
    /NCM/i,
    "sem NCM configurado, o próximo passo tem que travar por outro motivo — prova que passou das duas guardas"
  );
});
