/**
 * A escrita do retorno ao estoque, contra Postgres real.
 *
 * O que se protege aqui é o que NÃO dá para ver na tela: o ciclo que incrementa,
 * o histórico que fica, as datas que zeram e o carro que volta ao site.
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
const TEST_DB = "vamaq_retorno_test";

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
  for (const file of [
    "schema.sql",
    "auth-schema.sql",
    "fiscal-schema.sql",
    "fiscal-entrada.sql",
    "estoque-ciclo.sql",
  ]) {
    await pool.query(await readFile(path.join(ROOT, "db", file), "utf8"));
  }
});

after(async () => {
  // O pool do módulo real (src/lib/db.js) é de nível de módulo e não fecha
  // sozinho — sem isto o DROP DATABASE abaixo trava esperando ela soltar, e o
  // `node --test` fica pendurado depois do último teste (mesmo padrão de
  // tests/documentos-dados.test.mjs e tests/crm-registrar-venda.test.mjs).
  const { getPool } = await import("@/lib/db");
  await getPool()?.end();
  await pool?.end();
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.end();
});

// Este import é top-level await: roda ANTES do before, não depois. Não há
// problema porque getPool() (src/lib/db.js) é preguiçoso — só lê DATABASE_URL
// na PRIMEIRA chamada, e a primeira chamada acontece dentro de um teste, com o
// before já executado e a variável apontando para o banco de teste.
const { retornarAoEstoque, setVehicleStatus, getVehicleById } = await import(
  "../src/lib/vehicleStore.js"
);

async function carroVendido(slug) {
  const { rows } = await pool.query(
    `insert into vehicles (slug, brand, model, year, price, status, published,
                           data_entrada, data_saida)
     values ($1,'Audi','Q5',2022,200000,'vendido',false,'2026-01-10','2026-06-20')
     returning id`,
    [slug]
  );
  return rows[0].id;
}

test("o retorno abre o ciclo 2 e devolve o carro ao estoque e ao site", async () => {
  const id = await carroVendido("q5-retorno-ok");
  const r = await retornarAoEstoque(id, null);

  assert.equal(r.error, undefined, r.error);
  assert.equal(r.vehicle.ciclo, 2);
  assert.equal(r.vehicle.status, "disponivel");
  assert.equal(r.vehicle.published, true, "o carro tem que voltar para o site");
  assert.equal(r.vehicle.data_saida, null, "o ciclo novo ainda não teve saída");
  assert.ok(r.vehicle.data_entrada, "a entrada do ciclo novo é hoje");
});

test("o ciclo que fechou fica no histórico, com as datas e o preço originais", async () => {
  const id = await carroVendido("q5-retorno-historico");
  await retornarAoEstoque(id, null);

  const { rows } = await pool.query(
    `select ciclo, data_entrada, data_saida, price
       from vehicle_ciclos where vehicle_id = $1`,
    [id]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ciclo, 1);
  assert.equal(String(rows[0].data_entrada).slice(0, 10), "2026-01-10");
  assert.equal(String(rows[0].data_saida).slice(0, 10), "2026-06-20");
  assert.equal(Number(rows[0].price), 200000);
});

test("o preço do carro não é zerado — é ponto de partida para reprecificar", async () => {
  const id = await carroVendido("q5-retorno-preco");
  const r = await retornarAoEstoque(id, null);

  assert.equal(r.vehicle.price, 200000);
});

test("carro que não está vendido não retorna", async () => {
  const { rows } = await pool.query(
    `insert into vehicles (slug, brand, model, year, price, status)
     values ('q5-retorno-disponivel','Audi','Q5',2022,200000,'disponivel') returning id`
  );
  const r = await retornarAoEstoque(rows[0].id, null);

  assert.match(r.error, /vendido/i);
  const v = await getVehicleById(rows[0].id);
  assert.equal(v.ciclo, 1, "nada pode ter mudado");
});

test("veículo inexistente devolve erro, não explode", async () => {
  const r = await retornarAoEstoque("00000000-0000-0000-0000-000000000000", null);
  assert.ok(r.error);
});

test("retornar duas vezes não abre dois ciclos", async () => {
  const id = await carroVendido("q5-retorno-duas-vezes");
  await retornarAoEstoque(id, null);
  const segundo = await retornarAoEstoque(id, null);

  assert.ok(segundo.error, "o segundo retorno tem que ser recusado — já está disponível");
  const v = await getVehicleById(id);
  assert.equal(v.ciclo, 2);
});

test("um carro pode ir e voltar mais de uma vez", async () => {
  const id = await carroVendido("q5-retorno-ciclo-3");
  await retornarAoEstoque(id, null);
  await setVehicleStatus(id, "vendido");
  const r = await retornarAoEstoque(id, null);

  assert.equal(r.vehicle.ciclo, 3);
  const { rows } = await pool.query(
    `select ciclo from vehicle_ciclos where vehicle_id=$1 order by ciclo`,
    [id]
  );
  assert.deepEqual(rows.map((x) => x.ciclo), [1, 2]);
});

// Este teste NÃO prova atomicidade: o choque acontece no PRIMEIRO write
// (o insert em vehicle_ciclos), então o update em vehicles nunca é alcançado
// pelo controle de fluxo do JS — com ou sem transação, o resultado seria o
// mesmo. O que ele prova é outra coisa, que também vale a pena documentar:
// um clash de ciclo vira erro explícito, não um retorno silenciosamente
// incompleto. A prova de atomicidade de verdade é o teste seguinte, que força
// a falha no SEGUNDO write — depois que o primeiro já rodou.
test("choque no histórico é rejeitado, não silenciado", async () => {
  const id = await carroVendido("q5-retorno-choque-historico");
  // Planta o ciclo 1 no histórico ANTES do retorno de verdade: o insert que
  // retornarAoEstoque faz vai bater na unique(vehicle_id, ciclo) e estourar.
  await pool.query(
    `insert into vehicle_ciclos (vehicle_id, ciclo, data_entrada, data_saida, price)
     values ($1,1,'2026-01-10','2026-06-20',200000)`,
    [id]
  );

  await assert.rejects(() => retornarAoEstoque(id, null));

  const v = await getVehicleById(id);
  assert.equal(v.status, "vendido");
  assert.equal(v.ciclo, 1);
  assert.equal(String(v.data_saida).slice(0, 10), "2026-06-20");

  // E o histórico continua com só a linha plantada — nada extra foi arquivado.
  const { rows } = await pool.query(
    `select ciclo from vehicle_ciclos where vehicle_id = $1`,
    [id]
  );
  assert.deepEqual(rows.map((r) => r.ciclo), [1]);
});

// A prova real de atomicidade: o choque tem que acontecer no SEGUNDO write
// (o update em vehicles), depois que o insert em vehicle_ciclos já rodou.
// Só assim "o insert sumiu" só pode ser explicado por um rollback de verdade
// — não por o código nunca ter chegado lá.
//
// O gatilho é cirúrgico (só dispara para ESTE id) e é desfeito no finally,
// para sobreviver a uma asserção que falhe sem vazar para os testes seguintes.
test("update falha depois do insert: o insert já feito também é desfeito", async () => {
  const id = await carroVendido("q5-retorno-falha-update");

  await pool.query(`
    create or replace function _test_falha_update_veiculo() returns trigger as $$
    begin
      if OLD.id = '${id}' then
        raise exception 'falha proposital no update (teste de atomicidade)';
      end if;
      return new;
    end;
    $$ language plpgsql;
  `);
  await pool.query(`
    drop trigger if exists _test_falha_update_trigger on vehicles;
    create trigger _test_falha_update_trigger
      before update on vehicles
      for each row execute function _test_falha_update_veiculo();
  `);

  try {
    await assert.rejects(() => retornarAoEstoque(id, null));

    // O insert em vehicle_ciclos é a PRIMEIRA instrução de retornarAoEstoque
    // — ele já tinha rodado quando o update (a segunda) estourou. Se a linha
    // sumiu, só o rollback da transação explica.
    const { rows } = await pool.query(
      `select ciclo from vehicle_ciclos where vehicle_id = $1`,
      [id]
    );
    assert.deepEqual(
      rows,
      [],
      "o insert que já tinha rodado tem que ter sido desfeito junto com o update"
    );

    const v = await getVehicleById(id);
    assert.equal(v.status, "vendido");
    assert.equal(v.ciclo, 1);
    assert.equal(String(v.data_saida).slice(0, 10), "2026-06-20");
  } finally {
    // Roda mesmo se as asserções acima falharem — senão o gatilho ficaria
    // ativo para o resto do arquivo (ou, pior, só para este id, mas
    // silenciosamente diferente do esperado nos próximos testes).
    await pool.query(`drop trigger if exists _test_falha_update_trigger on vehicles`);
    await pool.query(`drop function if exists _test_falha_update_veiculo()`);
  }
});

test("encerrado_por grava o id de quem retornou o carro", async () => {
  const { rows: userRows } = await pool.query(
    `insert into users (name, email, password_hash, role)
     values ('Estoquista Teste', 'estoquista-retorno@vamaq.test', 'x', 'estoque')
     returning id`
  );
  const userId = userRows[0].id;

  const id = await carroVendido("q5-retorno-encerrado-por");
  const r = await retornarAoEstoque(id, userId);
  assert.equal(r.error, undefined, r.error);

  const { rows } = await pool.query(
    `select encerrado_por from vehicle_ciclos where vehicle_id = $1`,
    [id]
  );
  assert.equal(rows[0].encerrado_por, userId);
});

// --- O conserto do published no Reativar ------------------------------------

test("Reativar sem republicar mantém o comportamento de hoje", async () => {
  const { rows } = await pool.query(
    `insert into vehicles (slug, brand, model, year, price, status, published)
     values ('q5-reativar-padrao','Audi','Q5',2022,200000,'inativo',false) returning id`
  );
  const v = await setVehicleStatus(rows[0].id, "disponivel");
  assert.equal(v.published, false);
});

test("Reativar com republicar devolve o carro ao site", async () => {
  const { rows } = await pool.query(
    `insert into vehicles (slug, brand, model, year, price, status, published)
     values ('q5-reativar-republica','Audi','Q5',2022,200000,'inativo',false) returning id`
  );
  const v = await setVehicleStatus(rows[0].id, "disponivel", { republicar: true });
  assert.equal(v.published, true);
});

test("republicar não desfaz o unpublish de vendido", async () => {
  const { rows } = await pool.query(
    `insert into vehicles (slug, brand, model, year, price, status, published)
     values ('q5-vendido-republica','Audi','Q5',2022,200000,'disponivel',true) returning id`
  );
  const v = await setVehicleStatus(rows[0].id, "vendido", { republicar: true });
  assert.equal(v.published, false, "vendido sai do site, e isso vence o republicar");
});
