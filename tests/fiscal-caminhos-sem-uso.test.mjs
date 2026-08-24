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
    "auth-schema.sql",
    "fiscal-schema.sql",
    "fiscal-entrada.sql",
    "fiscal-consignacao-devolucao.sql",
    "fiscal-natop-60.sql",
    "fiscal-cfop-interestadual.sql",
    "fiscal-carta-correcao.sql",
    "fiscal-cancelamento-externo.sql",
    "fiscal-cancelamento-evidencia.sql",
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
    `insert into users (name, email, password_hash, role)
     values ('Operadora','op@vamaqmotors.com.br','x','secretaria')`
  );
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

// ── registrarCancelamentoExterno ───────────────────────────────────────────
//
// A contabilidade cancelou a NF 17 pelo sistema dela — inclusive fora do
// prazo, que a loja não consegue fazer sozinha. Sem registrar aqui, o nosso
// registro fica "autorizada" para sempre e a guarda bloqueia a reemissão do
// veículo, obrigando a loja a chamar suporte técnico para tarefa de operação.

test("registrar com protocolo cancela a nota e guarda a origem", async () => {
  const ref = await nota("autorizada", { operacao: "entrada", cfop: "1917" });
  const res = await notas.registrarCancelamentoExterno(ref, {
    protocolo: "131267840529098",
    justificativa: "Cancelada pela contabilidade por CFOP incorreto",
  });
  assert.equal(res.error, undefined, res.error);

  const { rows } = await pool.query(`select * from notas_fiscais where ref=$1`, [ref]);
  assert.equal(rows[0].status, "cancelada");
  assert.equal(rows[0].cancelamento_externo, true);
  assert.equal(rows[0].cancelamento_protocolo, "131267840529098");
  assert.ok(rows[0].cancelada_em);
});

test("protocolo malformado é recusado, e a nota não muda de estado", async () => {
  const ref = await nota();
  for (const p of ["123", "1312678405290980000"]) {
    const res = await notas.registrarCancelamentoExterno(ref, {
      protocolo: p,
      justificativa: "Cancelada pela contabilidade por CFOP incorreto",
    });
    assert.match(res.error, /tem 15/i, `protocolo ${JSON.stringify(p)} deveria recusar`);
  }
  // Texto sem número nenhum cai no caminho de quem não tem protocolo, e a
  // mensagem oferece a saída em vez de só reclamar do formato.
  const semDigito = await notas.registrarCancelamentoExterno(ref, {
    protocolo: "abc",
    justificativa: "Cancelada pela contabilidade por CFOP incorreto",
  });
  assert.match(semDigito.error, /confirmou/i);

  const { rows } = await pool.query(`select status from notas_fiscais where ref=$1`, [ref]);
  assert.equal(rows[0].status, "autorizada", "nenhuma tentativa pode ter mudado o estado");
});

test("sem protocolo E sem quem confirmou, não cancela", async () => {
  const ref = await nota();
  const res = await notas.registrarCancelamentoExterno(ref, {
    protocolo: "",
    confirmadoPor: "",
    justificativa: "Cancelada pela contabilidade por CFOP incorreto",
  });
  assert.match(res.error, /protocolo.*ou.*confirmou/is);
});

test("sem protocolo, mas com quem confirmou, o registro passa e diz a prova", async () => {
  // Contabilidade confirma por telefone e não manda o número. Travar aqui
  // fazia a operadora parar e ligar para o suporte — que é o que este caminho
  // existe para evitar. O registro guarda que a prova foi mais fraca.
  const ref = await nota();
  const res = await notas.registrarCancelamentoExterno(ref, {
    protocolo: "",
    confirmadoPor: "Rodrigo, da contabilidade",
    justificativa: "Cancelada pela contabilidade por CFOP incorreto",
  });
  assert.equal(res.error, undefined, res.error);

  const { rows } = await pool.query(`select * from notas_fiscais where ref=$1`, [ref]);
  assert.equal(rows[0].status, "cancelada");
  assert.equal(rows[0].cancelamento_evidencia, "confirmacao");
  assert.equal(rows[0].cancelamento_protocolo, null, "não pode inventar protocolo");
  assert.match(rows[0].cancelamento_confirmado_por, /Rodrigo/);
});

test("com protocolo, a prova registrada é a forte", async () => {
  const ref = await nota();
  await notas.registrarCancelamentoExterno(ref, {
    protocolo: "131267840529098",
    justificativa: "Cancelada pela contabilidade por CFOP incorreto",
  });
  const { rows } = await pool.query(`select * from notas_fiscais where ref=$1`, [ref]);
  assert.equal(rows[0].cancelamento_evidencia, "protocolo");
});

test("protocolo com pontuação é aceito — a pessoa copia da tela do contador", async () => {
  const ref = await nota();
  const res = await notas.registrarCancelamentoExterno(ref, {
    protocolo: "131.267.840.529.098",
    justificativa: "Cancelada pela contabilidade por CFOP incorreto",
  });
  assert.equal(res.error, undefined, res.error);
  const { rows } = await pool.query(`select cancelamento_protocolo from notas_fiscais where ref=$1`, [ref]);
  assert.equal(rows[0].cancelamento_protocolo, "131267840529098");
});

test("só nota autorizada pode ser marcada, e não duas vezes", async () => {
  const ref = await nota("erro");
  assert.match(
    (await notas.registrarCancelamentoExterno(ref, {
      protocolo: "131267840529098", justificativa: "Cancelada pela contabilidade",
    })).error,
    /só nota autorizada/i
  );

  await pool.query(`delete from notas_fiscais`);
  const r2 = await nota("autorizada");
  await notas.registrarCancelamentoExterno(r2, {
    protocolo: "131267840529098", justificativa: "Cancelada pela contabilidade",
  });
  assert.match(
    (await notas.registrarCancelamentoExterno(r2, {
      protocolo: "131267840529098", justificativa: "Cancelada pela contabilidade",
    })).error,
    /já consta como cancelada/i
  );
});

test("depois de registrado, o veículo volta a aceitar emissão", async () => {
  // É este o ponto: destravar sem depender de suporte técnico.
  const ref = await nota("autorizada", { operacao: "entrada", cfop: "1917" });
  let res = await notas.emitirNotaEntradaVeiculo(vehicleId, {
    remetente: { nome: "X", doc: "529.982.247-25", cep: "1", logradouro: "R", numero: "1", bairro: "B", municipio: "M", uf: "MG" },
    valorAquisicao: 1000,
  });
  assert.match(res.error, /já tem nota de entrada autorizada/i, "antes precisa bloquear");

  await notas.registrarCancelamentoExterno(ref, {
    protocolo: "131267840529098",
    justificativa: "Cancelada pela contabilidade por CFOP incorreto",
  });

  respostaFocus = { ok: false, corpo: { mensagem: "Focus indisponivel no teste" } };
  res = await notas.emitirNotaEntradaVeiculo(vehicleId, {
    remetente: { nome: "X", doc: "529.982.247-25", cep: "1", logradouro: "R", numero: "1", bairro: "B", municipio: "M", uf: "MG" },
    valorAquisicao: 1000,
  });
  assert.ok(!/já tem nota de entrada/i.test(res.error || ""), `continuou bloqueado: ${res.error}`);
});

// ── dadosParaRefazer ───────────────────────────────────────────────────────
//
// "Cancelada" responde o que aconteceu e deixa a pergunta seguinte no ar: e
// agora, preciso preencher tudo outra vez? A nota guarda a outra parte, o
// valor e o CFOP — refazer não precisa ser do zero.

test("nota cancelada devolve os dados para reemitir", async () => {
  const ref = await nota("autorizada", { operacao: "entrada", cfop: "2917" });
  await notas.registrarCancelamentoExterno(ref, {
    protocolo: "131267840529098",
    justificativa: "Cancelada pela contabilidade por CFOP incorreto",
  });

  const d = await notas.dadosParaRefazer(ref);
  assert.equal(d.vehicleId, vehicleId);
  assert.equal(d.operacao, "entrada");
  assert.equal(d.consignacao, true, "2917 é consignação, e o formulário precisa vir marcado");
  assert.equal(d.valor, 400000);
  assert.equal(d.contraparte.nome, "Henrique Andrade");
  assert.equal(d.contraparte.cep, "75.707-090", "o endereço inteiro volta, para não redigitar");
  assert.equal(d.numeroAnterior, "17");
});

test("compra cancelada volta SEM a marca de consignação", async () => {
  const ref = await nota("autorizada", { operacao: "entrada", cfop: "1102" });
  await notas.registrarCancelamentoExterno(ref, {
    protocolo: "131267840529098", justificativa: "Cancelada pela contabilidade",
  });
  assert.equal((await notas.dadosParaRefazer(ref)).consignacao, false);
});

test("nota viva não é oferecida para refazer — seria duplicar, não refazer", async () => {
  const ref = await nota("autorizada");
  assert.equal(await notas.dadosParaRefazer(ref), null);

  await pool.query(`delete from notas_fiscais`);
  const r2 = await nota("erro");
  assert.equal(await notas.dadosParaRefazer(r2), null);
});

test("referência inexistente devolve nulo, não estoura", async () => {
  assert.equal(await notas.dadosParaRefazer("nao-existe"), null);
});

test("a chave de acesso colada por engano é reconhecida, não recusada seco", async () => {
  // 44 números é a chave impressa no topo da DANFE — a confusão mais provável.
  // Dizer isso poupa a pessoa de conferir dígito por dígito o que colou.
  const ref = await nota();
  const res = await notas.registrarCancelamentoExterno(ref, {
    protocolo: "31260845348469000154550020000000171277393403",
    justificativa: "Cancelada pela contabilidade por CFOP incorreto",
  });
  assert.match(res.error, /chave de acesso/i);
  assert.match(res.error, /deixe o campo em branco/i, "precisa mostrar a saída");
});

test("protocolo de tamanho errado diz QUANTOS números vieram", async () => {
  const ref = await nota();
  const res = await notas.registrarCancelamentoExterno(ref, {
    protocolo: "12345",
    justificativa: "Cancelada pela contabilidade por CFOP incorreto",
  });
  // Sem o número, a pessoa não sabe se digitou a mais ou a menos.
  assert.match(res.error, /informou 5 números/i);
  assert.match(res.error, /deixe o campo em branco/i);
});

test("toda recusa de protocolo aponta a saída sem protocolo", async () => {
  // É o que impede a operadora de parar e ligar para o suporte.
  const ref = await nota();
  for (const p of ["1", "12345", "31260845348469000154550020000000171277393403"]) {
    const res = await notas.registrarCancelamentoExterno(ref, {
      protocolo: p,
      justificativa: "Cancelada pela contabilidade por CFOP incorreto",
    });
    assert.match(res.error, /em branco|confirmou/i, `sem saída para "${p}"`);
  }
});
