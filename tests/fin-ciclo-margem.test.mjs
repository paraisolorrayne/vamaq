/**
 * A margem por veículo é por CICLO, não por carro.
 *
 * POR QUE IMPORTA, e não é só relatório: getVehicleMargins alimenta
 * src/lib/fiscal/notas.js:51, de onde sai o `custoAquisicao` que vira a BASE DO
 * ICMS da nota de venda. Num carro em segundo ciclo, somar os dois ciclos
 * colocaria o custo da primeira compra na base do imposto da segunda venda —
 * erro silencioso, em nota já autorizada pela SEFAZ.
 *
 * Testa a agregação SQL contra Postgres real, sem subir o app.
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
const TEST_DB = "vamaq_fin_ciclo_test";
const FIN_PW = "fin_ciclo_test_pw";

function urlFor(user, pw) {
  const u = new URL(ADMIN_URL);
  return `${u.protocol}//${user}${pw ? ":" + pw : ""}@${u.hostname}:${u.port || 5432}/${TEST_DB}`;
}

// A MESMA agregação de getVehicleMargins (finance.js), sem o resto do módulo:
// aqui o que se protege é o group by, que é onde o ciclo entra.
const CONSULTA_MARGEM = `
  select v.id as vehicle_id,
         coalesce(t.ciclo, v.ciclo) as ciclo,
         v.ciclo as ciclo_atual,
         coalesce(sum(t.amount) filter (where t.type='revenue'), 0) as receita,
         coalesce(sum(t.amount) filter (where t.type='expense'), 0) as custo_total
    from public.vehicles v
    left join fin.transactions t
      on t.vehicle_id = v.id and t.status in ('confirmed','reconciled')
   group by v.id, coalesce(t.ciclo, v.ciclo), v.ciclo
   order by coalesce(t.ciclo, v.ciclo)
`;

// Pool do SUPERUSUÁRIO: só ele escreve em public.vehicles — a blindagem
// (db/fin-blindagem.sql) bloqueia a role vamaq_fin nessa tabela (ela só LÊ).
let suPool;
// Pool da role vamaq_fin: é quem aplica fin-schema.sql e fin-ciclo.sql, e quem
// lança em fin.transactions — o mesmo caminho que o app usa.
let finPool;
let companyId;
let accountReceita;
let accountDespesa;

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
  // public.vehicles, que vamaq_fin não pode escrever).
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
});

after(async () => {
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

async function lancar(vehicleId, tipo, valor) {
  await finPool.query(
    `insert into fin.transactions
       (company_id, account_id, vehicle_id, type, amount, status, date, description)
     values ($1,$2,$3,$4,$5,'confirmed',current_date,'lançamento de teste')`,
    [companyId, tipo === "revenue" ? accountReceita : accountDespesa, vehicleId, tipo, valor]
  );
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

test("cada ciclo tem a sua margem — os custos não se somam", async () => {
  const id = await novoVeiculo("q5-fin-dois-ciclos");
  // Ciclo 1: comprou por 100.000, vendeu por 150.000.
  await lancar(id, "expense", 100000);
  await lancar(id, "revenue", 150000);
  // Voltou na troca: ciclo 2, comprou por 130.000.
  await avancaCiclo(id, 2);
  await lancar(id, "expense", 130000);

  const { rows } = await finPool.query(CONSULTA_MARGEM);
  const doCarro = rows.filter((r) => r.vehicle_id === id);

  assert.equal(doCarro.length, 2, "um carro em dois ciclos dá duas linhas de margem");
  assert.equal(Number(doCarro[0].custo_total), 100000, "ciclo 1 não enxerga a recompra");
  assert.equal(Number(doCarro[0].receita), 150000);
  assert.equal(Number(doCarro[1].custo_total), 130000, "ciclo 2 não herda o custo do ciclo 1");
  assert.equal(Number(doCarro[1].receita), 0);
  assert.equal(doCarro[1].ciclo_atual, 2);
});

test("carro sem lançamento nenhum aparece uma vez, no ciclo dele", async () => {
  const id = await novoVeiculo("q5-fin-sem-lancamento");
  const { rows } = await finPool.query(CONSULTA_MARGEM);
  const doCarro = rows.filter((r) => r.vehicle_id === id);

  assert.equal(doCarro.length, 1, "o coalesce cobre o left join sem lançamento");
  assert.equal(doCarro[0].ciclo, 1);
  assert.equal(Number(doCarro[0].receita), 0);
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
