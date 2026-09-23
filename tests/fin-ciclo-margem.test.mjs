/**
 * A margem por veículo é por CICLO, não por carro.
 *
 * POR QUE IMPORTA, e não é só relatório: getVehicleMargins alimenta
 * src/lib/fiscal/notas.js:51, de onde sai o `custoAquisicao` que vira a BASE DO
 * ICMS da nota de venda. Num carro em segundo ciclo, somar os dois ciclos
 * colocaria o custo da primeira compra na base do imposto da segunda venda —
 * erro silencioso, em nota já autorizada pela SEFAZ.
 *
 * Chama a função de VERDADE (getVehicleMargins, de src/lib/fin/repositories/
 * finance.js), não uma cópia reescrita à mão — três versões da mesma agregação
 * (função, view, réplica de teste) é como elas divergem sem ninguém perceber.
 * Para isso, o `register()` abaixo resolve o alias "@/..." (que só existe para
 * o webpack do Next) e `DATABASE_URL_FIN` aponta para o banco descartável
 * criado abaixo, antes de importar o módulo — mesmo truque de
 * tests/crm-registrar-venda.test.mjs com `DATABASE_URL`.
 *
 * A view fin.v_vehicle_margin, essa sim, é exercitada por SQL direto (não é
 * réplica: é o artefato real que db/fin-ciclo.sql cria).
 *
 * PIN DO PONTO MAIS PERIGOSO (Task 5, fix round 1): este arquivo também
 * exercita getDadosEmissao — src/lib/fiscal/notas.js:56 — de ponta a ponta,
 * com os dois bancos de verdade (public via DATABASE_URL, fin via
 * DATABASE_URL_FIN). Escolhido este arquivo, e não fiscal-ciclo.test.mjs, por
 * já ter o arnês dos DOIS papéis pronto (vamaq_fin + superusuário); trazer
 * esse arnês inteiro para o arquivo fiscal seria duplicar tudo que já existe
 * aqui. tests/fiscal-ciclo.test.mjs nunca carrega o schema `fin` de propósito
 * — lá o ramo da margem sempre cai no catch e `custoOrigem` fica "ausente";
 * aqui é o inverso: o financeiro está de pé, e é aqui que se prova que
 * getDadosEmissao escolhe a linha do CICLO CORRENTE, não a primeira que achar.
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
const TEST_DB = "vamaq_fin_ciclo_test";
const FIN_PW = "fin_ciclo_test_pw";

function urlFor(user, pw) {
  const u = new URL(ADMIN_URL);
  return `${u.protocol}//${user}${pw ? ":" + pw : ""}@${u.hostname}:${u.port || 5432}/${TEST_DB}`;
}

// Pool do SUPERUSUÁRIO: só ele escreve em public.vehicles — a blindagem
// (db/fin-blindagem.sql) bloqueia a role vamaq_fin nessa tabela (ela só LÊ).
let suPool;
// Pool da role vamaq_fin, usado para aplicar os schemas e para os testes que
// exercitam o TRIGGER diretamente em SQL (a stamp em si, não a agregação).
let finPool;
let companyId;
let accountReceita;
let accountDespesa;
let accountOutraDespesa; // 4.2 (Preparação e Reparos) — NÃO é custo de aquisição.

// getVehicleMargins de verdade e o pool que ela usa por baixo (@/lib/fin/db),
// importados só depois de DATABASE_URL_FIN apontar para o banco de teste.
let getVehicleMargins;
let getFinPool;
// getDadosEmissao (notas.js) usa os DOIS bancos: query() de @/lib/db (público,
// DATABASE_URL) para vehicles/notas_fiscais, e getVehicleMargins (fin,
// DATABASE_URL_FIN) para o custo. As duas env vars precisam estar apontando
// para o banco de teste ANTES deste import.
let getDadosEmissao;
// getFechamentoMes chama pendenciasDeVeiculos (finance.js), a única função
// não coberta que também precisava do fix de ciclo (item 4 da revisão).
let getFechamentoMes;

before(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`drop role if exists vamaq_fin`);
  await admin.query(`create role vamaq_fin login password '${FIN_PW}'`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const su = new URL(ADMIN_URL).username || "postgres";
  suPool = new pg.Pool({ connectionString: urlFor(su) });
  // estoque + blindagem + ciclo do estoque: como SUPERUSUÁRIO (fin-blindagem
  // cria o schema `fin` e cede a dona pra vamaq_fin; estoque-ciclo altera
  // public.vehicles, que vamaq_fin não pode escrever). fiscal-entrada.sql vai
  // antes de estoque-ciclo.sql porque este último indexa notas_fiscais.operacao,
  // coluna que só fiscal-entrada.sql cria.
  for (const file of ["schema.sql", "auth-schema.sql", "fiscal-schema.sql", "fiscal-entrada.sql", "fin-blindagem.sql", "estoque-ciclo.sql"]) {
    await suPool.query(await readFile(path.join(ROOT, "db", file), "utf8"));
  }

  finPool = new pg.Pool({ connectionString: urlFor("vamaq_fin", FIN_PW) });
  // fin-schema.sql + fin-ciclo.sql: como a PRÓPRIA role do financeiro (dona do
  // schema fin) — o mesmo caminho de deploy real.
  for (const file of ["fin-schema.sql", "fin-ciclo.sql"]) {
    await finPool.query(await readFile(path.join(ROOT, "db", file), "utf8"));
  }

  const c = await finPool.query(`select id from fin.companies limit 1`);
  companyId = c.rows[0].id;
  const r = await finPool.query(
    `select id from fin.chart_of_accounts where company_id=$1 and type='revenue' limit 1`,
    [companyId]
  );
  accountReceita = r.rows[0].id;
  const d = await finPool.query(
    `select id from fin.chart_of_accounts where company_id=$1 and code like '4.1%' limit 1`,
    [companyId]
  );
  accountDespesa = d.rows[0].id;
  const o = await finPool.query(
    `select id from fin.chart_of_accounts where company_id=$1 and code = '4.2' limit 1`,
    [companyId]
  );
  accountOutraDespesa = o.rows[0].id;

  // A PARTIR DAQUI: DATABASE_URL_FIN aponta pro banco de teste, e só então
  // importamos o módulo de verdade — getFinPool() (src/lib/fin/db.js) lê a
  // env var e cacheia o pool na primeira consulta. DATABASE_URL (superusuário,
  // mesmo banco) é o que getDadosEmissao usa para ler vehicles/notas_fiscais.
  process.env.DATABASE_URL_FIN = urlFor("vamaq_fin", FIN_PW);
  process.env.DATABASE_URL = urlFor(su);
  ({ getVehicleMargins, getFechamentoMes } = await import("@/lib/fin/repositories/finance"));
  ({ getFinPool } = await import("@/lib/fin/db"));
  ({ getDadosEmissao } = await import("@/lib/fiscal/notas"));
});

after(async () => {
  // getFinPool() de @/lib/fin/db é singleton por processo — getVehicleMargins
  // o abriu por baixo dos panos, e ele nunca fecha sozinho. Sem fechar aqui, o
  // DROP DATABASE abaixo trava esperando a conexão soltar.
  await getFinPool?.()?.end();
  // Mesma história para o pool público que getDadosEmissao (via @/lib/db)
  // abriu por baixo dos panos — outro singleton de módulo que não fecha
  // sozinho.
  const { getPool } = await import("@/lib/db");
  await getPool()?.end();
  delete process.env.DATABASE_URL_FIN;
  await suPool?.end();
  await finPool?.end();
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`drop role if exists vamaq_fin`);
  await admin.end();
});

async function novoVeiculo(slug) {
  const { rows } = await suPool.query(
    `insert into vehicles (slug, brand, model, year, price)
     values ($1,'Audi','Q5',2022,200000) returning id`,
    [slug]
  );
  return rows[0].id;
}

// A blindagem impede vamaq_fin de escrever em public.vehicles — todo update
// de ciclo do veículo vai pelo pool do SUPERUSUÁRIO.
async function avancaCiclo(vehicleId, ciclo) {
  await suPool.query(`update vehicles set ciclo = $2 where id = $1`, [vehicleId, ciclo]);
}

async function lancarNaConta(vehicleId, accountId, tipo, valor) {
  const { rows } = await finPool.query(
    `insert into fin.transactions
       (company_id, account_id, vehicle_id, type, amount, status, date, description)
     values ($1,$2,$3,$4,$5,'confirmed',current_date,'lançamento de teste')
     returning id`,
    [companyId, accountId, vehicleId, tipo, valor]
  );
  return rows[0].id;
}

async function lancar(vehicleId, tipo, valor) {
  return lancarNaConta(vehicleId, tipo === "revenue" ? accountReceita : accountDespesa, tipo, valor);
}

/** As margens do getVehicleMargins de VERDADE, filtradas a um carro e ordenadas por ciclo. */
async function margensDoCarro(vehicleId) {
  const todas = await getVehicleMargins({ onlyWithActivity: false });
  return todas.filter((m) => m.vehicle_id === vehicleId).sort((a, b) => a.ciclo - b.ciclo);
}

test("lançamento nasce carimbado com o ciclo do veículo", async () => {
  const id = await novoVeiculo("q5-fin-carimbo");
  await avancaCiclo(id, 2);
  await lancar(id, "expense", 100000);
  const { rows } = await finPool.query(
    `select ciclo from fin.transactions where vehicle_id = $1`,
    [id]
  );
  assert.equal(rows[0].ciclo, 2);
});

test("update que ANEXA o veículo carimba o ciclo — o fluxo normal é lançar e só depois linkar", async () => {
  const id = await novoVeiculo("q5-fin-update-anexa");
  await avancaCiclo(id, 2);

  // Insere SEM carro — vehicle_id nulo, trigger de INSERT não tem o que
  // carimbar, fica no default 1.
  const { rows: ins } = await finPool.query(
    `insert into fin.transactions (company_id, account_id, type, amount, status, date, description)
     values ($1,$2,'expense',100000,'confirmed',current_date,'despesa lançada solta, carro vem depois')
     returning id, ciclo`,
    [companyId, accountDespesa]
  );
  assert.equal(ins[0].ciclo, 1, "sem vehicle_id no insert, não tem o que o trigger carimbe");

  // Agora liga ao carro — mesmo caminho de updateTransaction em finance.js.
  await finPool.query(`update fin.transactions set vehicle_id=$2 where id=$1`, [ins[0].id, id]);

  const { rows } = await finPool.query(`select ciclo from fin.transactions where id=$1`, [ins[0].id]);
  assert.equal(rows[0].ciclo, 2, "anexar o carro no UPDATE carimba o ciclo dele — sem isso a compra ficaria presa no ciclo 1 default");
});

test("update que só muda o valor NÃO recarimba um lançamento antigo", async () => {
  const id = await novoVeiculo("q5-fin-update-so-valor");
  const txId = await lancar(id, "expense", 100000); // carimbado ciclo 1
  await avancaCiclo(id, 2); // o carro avança, mas o lançamento já está gravado no ciclo 1

  await finPool.query(`update fin.transactions set amount=$2 where id=$1`, [txId, 150000]);

  const { rows } = await finPool.query(`select ciclo, amount from fin.transactions where id=$1`, [txId]);
  assert.equal(rows[0].ciclo, 1, "editar o valor não pode empurrar o lançamento pra frente pro ciclo novo");
  assert.equal(Number(rows[0].amount), 150000, "o valor em si tem que ter mudado — a trava é só no ciclo");
});

test("cada ciclo tem a sua margem — os custos não se somam", async () => {
  const id = await novoVeiculo("q5-fin-dois-ciclos");
  // Ciclo 1: comprou por 100.000, vendeu por 150.000.
  await lancar(id, "expense", 100000);
  await lancar(id, "revenue", 150000);
  // Voltou na troca: ciclo 2, comprou por 130.000.
  await avancaCiclo(id, 2);
  await lancar(id, "expense", 130000);

  const doCarro = await margensDoCarro(id);

  assert.equal(doCarro.length, 2, "um carro em dois ciclos dá duas linhas de margem");
  assert.equal(doCarro[0].custo_total, 100000, "ciclo 1 não enxerga a recompra");
  assert.equal(doCarro[0].receita, 150000);
  assert.equal(doCarro[1].custo_total, 130000, "ciclo 2 não herda o custo do ciclo 1");
  assert.equal(doCarro[1].receita, 0);
  assert.equal(doCarro[1].ciclo_atual, 2);
});

test("custo_aquisicao é só o 4.1x DO CICLO — não soma ciclos, não pega despesa de preparação", async () => {
  const id = await novoVeiculo("q5-fin-custo-aquisicao");
  // Ciclo 1: aquisição (4.1x) 100.000.
  await lancar(id, "expense", 100000);
  await avancaCiclo(id, 2);
  // Ciclo 2: aquisição (4.1x) 130.000 + preparação (4.2, NÃO é aquisição) 5.000.
  await lancar(id, "expense", 130000);
  await lancarNaConta(id, accountOutraDespesa, "expense", 5000);

  const doCarro = await margensDoCarro(id);

  assert.equal(doCarro.length, 2);
  assert.equal(doCarro[0].custo_aquisicao, 100000, "ciclo 1 mantém o custo de aquisição dele");
  assert.equal(
    doCarro[1].custo_aquisicao,
    130000,
    "ciclo 2: custo_aquisicao é EXATAMENTE o 4.1x do ciclo 2 — nem soma o ciclo 1, nem pega a preparação. " +
      "Esse é o número que vira base do ICMS da nota (ver notas.js)."
  );
  assert.equal(doCarro[1].custo_total, 135000, "custo_total, esse sim, inclui a preparação — só a base do ICMS é filtrada");
});

test("carro sem lançamento nenhum aparece uma vez, no ciclo dele", async () => {
  const id = await novoVeiculo("q5-fin-sem-lancamento");
  const doCarro = await margensDoCarro(id);

  assert.equal(doCarro.length, 1, "o coalesce cobre o left join sem lançamento");
  assert.equal(doCarro[0].ciclo, 1);
  assert.equal(doCarro[0].receita, 0);
});

test("carro que voltou na troca mas ainda sem lançamento no ciclo novo: só a linha do ciclo fechado aparece", async () => {
  const id = await novoVeiculo("q5-fin-ciclo-novo-vazio");
  // Ciclo 1 fechado: comprou e vendeu.
  await lancar(id, "expense", 100000);
  await lancar(id, "revenue", 150000);
  // Voltou na troca — ciclo avança pra 2, mas a compra da recompra ainda não
  // foi lançada no financeiro (a nota de entrada pode levar dias).
  await avancaCiclo(id, 2);

  const doCarro = await margensDoCarro(id);

  // Contrato documentado em finance.js e fin-ciclo.sql: sem lançamento algum
  // no ciclo 2, não sai uma linha "vazia" pra ele — só a do ciclo 1 fechado.
  // Tasks 5/6, que casam por (vehicle_id, ciclo_atual), têm que esperar essa
  // ausência em vez de assumir presença.
  assert.equal(doCarro.length, 1, "sem lançamento no ciclo 2, nenhuma linha sintética aparece pra ele");
  assert.equal(doCarro[0].ciclo, 1);
  assert.equal(doCarro[0].ciclo_atual, 2, "mas ciclo_atual já reflete o carro ter avançado");
});

test("a view acompanha a mesma agregação da função", async () => {
  const id = await novoVeiculo("q5-fin-view");
  await lancar(id, "expense", 90000);
  await avancaCiclo(id, 2);
  await lancar(id, "expense", 70000);

  const { rows } = await finPool.query(
    `select ciclo, custo_total from fin.v_vehicle_margin
      where vehicle_id = $1 order by ciclo`,
    [id]
  );
  assert.equal(rows.length, 2, "a view não pode divergir da função");
  assert.equal(Number(rows[0].custo_total), 90000);
  assert.equal(Number(rows[1].custo_total), 70000);
});

// ── getDadosEmissao × ciclo (notas.js:56) ───────────────────────────────────
//
// O PONTO MAIS PERIGOSO do task inteiro: custoAquisicao vira a BASE DO ICMS
// da nota de venda (ver notas.js e lib/fiscal/impostos.js). Os testes acima
// provam que getVehicleMargins devolve uma linha por ciclo; este prova que
// getDadosEmissao — a função que a tela de emissão de verdade chama — pega a
// linha do ciclo CORRETO, e não a primeira que aparecer no array.

test("getDadosEmissao usa o custo de aquisição do CICLO CORRENTE, não do ciclo antigo", async () => {
  const id = await novoVeiculo("q5-fin-icms-base-ciclo");
  // Ciclo 1: comprou por 100.000 — carro já vendido e devolvido na troca.
  await lancar(id, "expense", 100000);
  // Voltou: ciclo 2, comprou de novo por um valor DIFERENTE — 130.000.
  await avancaCiclo(id, 2);
  await lancar(id, "expense", 130000);

  const dados = await getDadosEmissao(id);

  assert.equal(dados.custoOrigem, "financeiro");
  assert.equal(
    dados.custoAquisicao,
    130000,
    "citar o custo do ciclo 1 (100.000) na base do ICMS da venda do ciclo 2 " +
      "seria imposto calculado sobre a compra errada, de outro vendedor"
  );
});

test("no ciclo 1, getDadosEmissao continua usando o custo do ciclo 1 — como hoje", async () => {
  const id = await novoVeiculo("q5-fin-icms-base-ciclo1");
  await lancar(id, "expense", 90000);

  const dados = await getDadosEmissao(id);

  assert.equal(dados.custoOrigem, "financeiro");
  assert.equal(dados.custoAquisicao, 90000);
});

// ── pendenciasDeVeiculos × ciclo (finance.js, item 4 da revisão) ───────────
//
// O checklist de fechamento existe para pegar "vendido sem nota". Sem o
// ciclo no join, a nota AUTORIZADA de um ciclo antigo satisfazia o join e
// escondia justamente o caso que o retorno ao estoque cria: o carro vendido
// de novo, no ciclo atual, ainda sem nota nenhuma emitida.

test("getFechamentoMes: nota autorizada de um ciclo antigo não cobre a venda do ciclo atual no checklist", async () => {
  const id = await novoVeiculo("q5-fin-checklist-ciclo");
  // Nota de saída AUTORIZADA, gravada enquanto o veículo ainda era ciclo 1 —
  // o trigger de estoque-ciclo.sql carimba pelo ciclo do veículo NO MOMENTO
  // do insert, então isto só funciona feito ANTES de avançar o ciclo.
  await suPool.query(
    `insert into notas_fiscais (ref, vehicle_id, status, valor, operacao, serie)
     values ('vamaq-checklist-c1',$1,'autorizada',200000,'saida','2')`,
    [id]
  );
  // Ciclo avança: o carro voltou na troca e foi vendido de novo — SEM nota
  // nova ainda. data_saida cai dentro do mês do fechamento abaixo.
  await suPool.query(
    `update vehicles set status='vendido', data_saida='2027-03-15', ciclo=2 where id=$1`,
    [id]
  );

  const fechamento = await getFechamentoMes(2027, 3);

  assert.equal(fechamento.pendencias.vendidos, 1);
  assert.equal(
    fechamento.pendencias.vendidos_sem_nota,
    1,
    "a nota autorizada do ciclo 1 não pode cobrir a venda do ciclo 2 — o checklist tem que acusar 'sem nota'"
  );
});
