# Retorno ao estoque — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** um carro vendido que volta na troca volta ao estoque no próprio cadastro, abrindo um ciclo novo, sem recadastro e sem travar a próxima nota fiscal.

**Architecture:** `vehicles.ciclo` (default 1) versiona o ciclo de compra e venda. `notas_fiscais` e `fin.transactions` nascem carimbados com o ciclo do veículo, por trigger. As guardas fiscais e a margem passam a filtrar por ciclo corrente. Ciclos encerrados vão para `vehicle_ciclos`.

**Tech Stack:** Next.js 16.2.3 (App Router), React 19, Postgres (`pg`), `node --test`. Sem TypeScript — JS puro. CSS Modules.

**Spec:** `docs/superpowers/specs/2026-09-17-retorno-ao-estoque-design.md`

## Global Constraints

- **`default 1` em toda coluna `ciclo`.** É o que torna a mudança retrocompatível: todo dado existente fica no ciclo 1 e as guardas comparam `1 = 1`.
- **Nenhuma nota emitida é alterada ou cancelada.** O trabalho só muda o que acontece daqui pra frente.
- **Todo `.sql` é idempotente** (`add column if not exists`, `create ... if not exists`, `do $$ ... end $$` para constraint/trigger). Rodar de novo é o jeito normal de aplicar em produção.
- **Módulos de regra pura não têm import nenhum** — nem o alias `@/`, que não resolve em `node --test`. Padrão de `src/lib/vendaVeiculo.js` e `src/lib/anoVeiculo.js`.
- **Testes de schema rodam contra Postgres real** (`TEST_ADMIN_URL`, default `postgres://postgres@localhost:5432/postgres`), criando e derrubando um banco próprio. Postgres local confirmado funcionando.
- **Comentários em português**, explicando *por que*, no tom dos arquivos vizinhos.
- **`npm test` roda a suíte inteira** (733 testes antes deste trabalho); cada commit exige ela verde.
- **Mensagem de commit:** termina com `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- **Git roda como a dona do repo:** `sudo -n -u lorrayneparaiso git ...` — as ferramentas rodam como root e escrever no `.git` como root quebra o git dela.

---

### Task 1: A regra pura do retorno

**Files:**
- Create: `src/lib/estoque/retornoVeiculo.js`
- Test: `tests/estoque-retorno.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `podeRetornarAoEstoque(veiculo) -> boolean`. Usada pela lista do Estoque (Task 7) e reconferida na escrita (Task 4).

- [ ] **Step 1: Write the failing test**

Criar `tests/estoque-retorno.test.mjs`:

```js
/**
 * Quando um carro vendido pode voltar ao estoque.
 *
 * O PEDIDO (Mayra, 17/09/2026, por áudio): um carro que o Mateus vendeu voltou
 * na troca de outro, e "pra ele poder aparecer aqui no estoque, tá como vendido,
 * não tem como eu voltar — vou ter que fazer um novo cadastro desse veículo".
 *
 * Só `vendido` volta: `disponivel` e `reservado` nunca saíram, e `inativo` tem o
 * caminho próprio (Reativar), que NÃO abre ciclo novo — desativar não é vender.
 *
 *   npm test   (função pura, sem banco)
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { podeRetornarAoEstoque } from "../src/lib/estoque/retornoVeiculo.js";

test("carro vendido pode voltar ao estoque", () => {
  assert.equal(podeRetornarAoEstoque({ status: "vendido" }), true);
});

test("carro disponível não volta — ele nunca saiu", () => {
  assert.equal(podeRetornarAoEstoque({ status: "disponivel" }), false);
});

test("carro reservado não volta — ele nunca saiu", () => {
  assert.equal(podeRetornarAoEstoque({ status: "reservado" }), false);
});

test("carro inativo não volta por aqui — o caminho dele é Reativar", () => {
  assert.equal(podeRetornarAoEstoque({ status: "inativo" }), false);
});

test("sem veículo não dá para decidir nada", () => {
  assert.equal(podeRetornarAoEstoque(null), false);
  assert.equal(podeRetornarAoEstoque(undefined), false);
});

test("status desconhecido não volta", () => {
  assert.equal(podeRetornarAoEstoque({ status: "qualquer_coisa" }), false);
  assert.equal(podeRetornarAoEstoque({}), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/estoque-retorno.test.mjs`
Expected: FAIL — `Cannot find module '.../src/lib/estoque/retornoVeiculo.js'`

- [ ] **Step 3: Write minimal implementation**

Criar `src/lib/estoque/retornoVeiculo.js`:

```js
/**
 * Regra de quando um veículo vendido pode voltar ao estoque — o carro que a
 * Vamaq vendeu e recebeu de volta como parte do pagamento de outro.
 *
 * Pura, sem imports: usada no botão da lista do Estoque e no teste, que roda em
 * `node --test`, onde o alias "@/" não resolve. Mesmo padrão de
 * src/lib/vendaVeiculo.js, a contraparte desta regra.
 *
 * Só `vendido` volta. `disponivel` e `reservado` nunca saíram do pátio, e
 * `inativo` tem caminho próprio ("Reativar"), que NÃO abre ciclo novo:
 * desativar não é vender, e um carro desativado por engano não deve ganhar uma
 * segunda compra no histórico só por ser reativado.
 */
export function podeRetornarAoEstoque(veiculo) {
  if (!veiculo) return false;
  return veiculo.status === "vendido";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/estoque-retorno.test.mjs`
Expected: PASS — 6 testes.

- [ ] **Step 5: Commit**

```bash
sudo -n -u lorrayneparaiso git add src/lib/estoque/retornoVeiculo.js tests/estoque-retorno.test.mjs
sudo -n -u lorrayneparaiso git commit -m "feat: regra de quando um carro vendido pode voltar ao estoque

Contraparte de podeMarcarVendido. Só vendido volta: disponivel e reservado
nunca saíram, e inativo tem o caminho próprio (Reativar), que não abre ciclo
novo — desativar não é vender.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: O schema do ciclo

**Files:**
- Create: `db/estoque-ciclo.sql`
- Modify: `db/aplicar-schemas.sh` (lista `ARQUIVOS` e o cabeçalho de ordem)
- Test: `tests/estoque-ciclo-schema.test.mjs`

**Interfaces:**
- Consumes: `db/schema.sql` (vehicles), `db/auth-schema.sql` (users), `db/fiscal-schema.sql` (notas_fiscais).
- Produces: colunas `vehicles.ciclo`, `notas_fiscais.ciclo` (default 1); tabela `vehicle_ciclos(vehicle_id, ciclo, data_entrada, data_saida, price, encerrado_em, encerrado_por)`; trigger `notas_fiscais_carimba_ciclo`. O `fin.transactions.ciclo` fica na Task 3 — schema `fin` é outra conexão.

- [ ] **Step 1: Write the failing test**

Criar `tests/estoque-ciclo-schema.test.mjs`:

```js
/**
 * Contrato do schema do ciclo de vida do veículo, contra Postgres real.
 *
 *   1. vehicles.ciclo nasce em 1 — é o que torna a mudança retrocompatível;
 *   2. notas_fiscais.ciclo também, para toda nota que já existe;
 *   3. o trigger carimba a nota com o ciclo DO VEÍCULO, não com o default;
 *   4. vehicle_ciclos não aceita o mesmo ciclo duas vezes no mesmo carro;
 *   5. apagar o veículo leva os ciclos junto (cascade).
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
const TEST_DB = "vamaq_ciclo_test";

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
  pool = new pg.Pool({ connectionString: urlFor(su) });
  // A ordem é a de db/aplicar-schemas.sh: fiscal ALTERA vehicles, e o ciclo
  // ALTERA os dois.
  for (const file of ["schema.sql", "auth-schema.sql", "fiscal-schema.sql", "estoque-ciclo.sql"]) {
    await pool.query(await readFile(path.join(ROOT, "db", file), "utf8"));
  }
});

after(async () => {
  await pool?.end();
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.end();
});

async function novoVeiculo(slug) {
  const { rows } = await pool.query(
    `insert into vehicles (slug, brand, model, year, price)
     values ($1,'Audi','Q5',2022,200000) returning id, ciclo`,
    [slug]
  );
  return rows[0];
}

test("veículo novo nasce no ciclo 1", async () => {
  const v = await novoVeiculo("q5-ciclo-1");
  assert.equal(v.ciclo, 1);
});

test("aplicar o arquivo duas vezes não dói", async () => {
  const sql = await readFile(path.join(ROOT, "db", "estoque-ciclo.sql"), "utf8");
  await pool.query(sql);
  const { rows } = await pool.query(
    `select column_default from information_schema.columns
      where table_name='vehicles' and column_name='ciclo'`
  );
  assert.equal(rows.length, 1);
});

test("o trigger carimba a nota com o ciclo do veículo", async () => {
  const v = await novoVeiculo("q5-ciclo-trigger");
  await pool.query(`update vehicles set ciclo = 2 where id = $1`, [v.id]);
  await pool.query(
    `insert into notas_fiscais (ref, vehicle_id, status, valor)
     values ('ref-ciclo-2', $1, 'autorizada', 200000)`,
    [v.id]
  );
  const { rows } = await pool.query(
    `select ciclo from notas_fiscais where ref = 'ref-ciclo-2'`
  );
  assert.equal(rows[0].ciclo, 2, "a nota tem que nascer no ciclo corrente do carro");
});

test("nota do carro no ciclo 1 continua no ciclo 1", async () => {
  const v = await novoVeiculo("q5-ciclo-um");
  await pool.query(
    `insert into notas_fiscais (ref, vehicle_id, status, valor)
     values ('ref-ciclo-1', $1, 'autorizada', 200000)`,
    [v.id]
  );
  const { rows } = await pool.query(
    `select ciclo from notas_fiscais where ref = 'ref-ciclo-1'`
  );
  assert.equal(rows[0].ciclo, 1);
});

test("vehicle_ciclos não aceita o mesmo ciclo duas vezes no mesmo carro", async () => {
  const v = await novoVeiculo("q5-ciclo-unico");
  await pool.query(
    `insert into vehicle_ciclos (vehicle_id, ciclo, data_entrada, data_saida, price)
     values ($1, 1, '2026-01-10', '2026-06-20', 200000)`,
    [v.id]
  );
  await assert.rejects(
    () =>
      pool.query(
        `insert into vehicle_ciclos (vehicle_id, ciclo, data_entrada, data_saida, price)
         values ($1, 1, '2026-01-10', '2026-06-20', 200000)`,
        [v.id]
      ),
    /duplicate key|unique/i
  );
});

test("apagar o veículo leva o histórico de ciclos junto", async () => {
  const v = await novoVeiculo("q5-ciclo-cascade");
  await pool.query(
    `insert into vehicle_ciclos (vehicle_id, ciclo, data_entrada, data_saida, price)
     values ($1, 1, '2026-01-10', '2026-06-20', 200000)`,
    [v.id]
  );
  await pool.query(`delete from vehicles where id = $1`, [v.id]);
  const { rows } = await pool.query(
    `select 1 from vehicle_ciclos where vehicle_id = $1`,
    [v.id]
  );
  assert.equal(rows.length, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/estoque-ciclo-schema.test.mjs`
Expected: FAIL no `before` — `ENOENT ... db/estoque-ciclo.sql`

- [ ] **Step 3: Write minimal implementation**

Criar `db/estoque-ciclo.sql`:

```sql
-- ============================================================================
-- VAMAQ MOTORS — ciclo de vida do veículo (compra → venda → retorno).
--
-- POR QUE ISTO EXISTE: o carro que a Vamaq vende e recebe de VOLTA numa troca
-- é uma nova aquisição — nota de entrada própria, custo próprio, e a próxima
-- nota de venda cita ESSA entrada. Sem um número de ciclo, o sistema assume
-- que uma linha de `vehicles` é UM ciclo: as guardas de notas_fiscais barram a
-- segunda nota de entrada e a segunda de saída do mesmo vehicle_id, e o único
-- caminho sobra recadastrar o carro (Mayra, 17/09/2026).
--
-- O `default 1` é o que torna isto retrocompatível: todo carro e toda nota que
-- existem hoje ficam no ciclo 1, e as guardas passam a comparar 1 = 1.
--
-- Ver docs/superpowers/specs/2026-09-17-retorno-ao-estoque-design.md
--
-- Aplicar:  psql "$DATABASE_URL" -f db/estoque-ciclo.sql   (re-aplicável)
-- Depende de: schema.sql (vehicles), auth-schema.sql (users),
--             fiscal-schema.sql (notas_fiscais)
-- ============================================================================

alter table vehicles      add column if not exists ciclo int not null default 1;
alter table notas_fiscais add column if not exists ciclo int not null default 1;

-- A guarda "este veículo já tem nota desta operação" passa a ser por ciclo.
create index if not exists notas_fiscais_veiculo_operacao_ciclo_idx
  on notas_fiscais(vehicle_id, operacao, ciclo);

-- Os ciclos JÁ ENCERRADOS. O corrente vive nas colunas de `vehicles`
-- (data_entrada/data_saida), que são uma só de cada — sem esta tabela, abrir o
-- ciclo 2 sobrescreveria a compra original e ela sumiria do relatório de
-- entradas e saídas.
create table if not exists vehicle_ciclos (
  id            uuid primary key default gen_random_uuid(),
  vehicle_id    uuid not null references vehicles(id) on delete cascade,
  ciclo         int  not null,
  data_entrada  date,
  data_saida    date,
  price         numeric(12,2),
  encerrado_em  timestamptz not null default now(),
  encerrado_por uuid references users(id),
  unique (vehicle_id, ciclo)
);

create index if not exists vehicle_ciclos_vehicle_idx on vehicle_ciclos(vehicle_id);

-- O carimbo do ciclo é TRIGGER, não código de aplicação. Hoje são três pontos
-- de inserção de nota (src/lib/fiscal/notas.js) e dois de lançamento; com
-- trigger, nenhum deles pode esquecer — nem os que forem escritos depois.
-- Mesma razão pela qual data_saida é carimbada no update de status, e não
-- pedida à operadora.
create or replace function carimba_ciclo_do_veiculo() returns trigger as $$
begin
  if new.vehicle_id is not null then
    select v.ciclo into new.ciclo from vehicles v where v.id = new.vehicle_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists notas_fiscais_carimba_ciclo on notas_fiscais;
create trigger notas_fiscais_carimba_ciclo
  before insert on notas_fiscais
  for each row execute function carimba_ciclo_do_veiculo();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/estoque-ciclo-schema.test.mjs`
Expected: PASS — 6 testes.

- [ ] **Step 5: Colocar o arquivo na ordem de aplicação**

Em `db/aplicar-schemas.sh`, acrescentar ao comentário da ordem, depois da linha 7 (`crm-schema.sql`):

```
--   8. estoque-ciclo.sql   ALTERA vehicles E notas_fiscais, referencia users
--                          (ou seja: precisa de schema, auth e fiscal)
```

E acrescentar `estoque-ciclo.sql` ao fim do array `ARQUIVOS`, depois de `crm-schema.sql`. Trocar também as duas frases que dizem "sete": o `echo` final (`"Sete schemas do public aplicados."` → `"Oito schemas do public aplicados."`) e o comentário do laço de checagem (`"Checa os sete ANTES de aplicar"` → `"Checa os oito ANTES de aplicar"`).

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: 0 fail. Nenhum teste existente pode mudar de resultado: o `default 1` deixa todo dado atual no ciclo 1.

- [ ] **Step 7: Commit**

```bash
sudo -n -u lorrayneparaiso git add db/estoque-ciclo.sql db/aplicar-schemas.sh tests/estoque-ciclo-schema.test.mjs
sudo -n -u lorrayneparaiso git commit -m "feat: schema do ciclo de vida do veículo, com carimbo por trigger

vehicles.ciclo e notas_fiscais.ciclo nascem em 1 — é o que torna a mudança
retrocompatível: todo dado existente fica no ciclo 1 e as guardas passam a
comparar 1 = 1. vehicle_ciclos guarda os ciclos encerrados, senão abrir o
ciclo 2 sobrescreveria a compra original.

O carimbo é trigger porque são cinco pontos de inserção hoje e nenhum deles
pode esquecer — nem os que forem escritos depois.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: O ciclo no financeiro

**Files:**
- Create: `db/fin-ciclo.sql`
- Modify: `db/fin-schema.sql:195-206` (view `v_vehicle_margin`)
- Modify: `src/lib/fin/repositories/finance.js:246-257` (consulta de `getVehicleMargins`), `:259-272` (o `map` do retorno), `:608-611` (placar de saúde)
- Test: `tests/fin-ciclo-margem.test.mjs`

**Interfaces:**
- Consumes: `vehicles.ciclo` (Task 2).
- Produces: `fin.transactions.ciclo`; `getVehicleMargins()` devolve, em cada linha, **também** `ciclo` (int) e `ciclo_atual` (int) — uma linha por `(vehicle_id, ciclo)`. Tasks 5 e 6 casam por esses dois campos.

**Por que esta task existe:** `getVehicleMargins` alimenta `notas.js:51`, de onde sai o `custoAquisicao` que vira **base do ICMS da nota**. Num carro em segundo ciclo, a soma traria junto o custo da primeira compra — imposto sobre base errada, em nota autorizada.

- [ ] **Step 1: Write the failing test**

Criar `tests/fin-ciclo-margem.test.mjs`:

```js
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

function urlFor(user) {
  const u = new URL(ADMIN_URL);
  return `${u.protocol}//${user}@${u.hostname}:${u.port || 5432}/${TEST_DB}`;
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

let pool;
let companyId;
let accountReceita;
let accountDespesa;

before(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const su = new URL(ADMIN_URL).username || "postgres";
  pool = new pg.Pool({ connectionString: urlFor(su) });
  for (const file of [
    "schema.sql", "auth-schema.sql", "fiscal-schema.sql",
    "estoque-ciclo.sql", "fin-schema.sql", "fin-ciclo.sql",
  ]) {
    await pool.query(await readFile(path.join(ROOT, "db", file), "utf8"));
  }
  const c = await pool.query(`select id from fin.companies limit 1`);
  companyId = c.rows[0].id;
  const r = await pool.query(
    `select id from fin.chart_of_accounts where company_id=$1 and type='revenue' limit 1`,
    [companyId]
  );
  accountReceita = r.rows[0].id;
  const d = await pool.query(
    `select id from fin.chart_of_accounts where company_id=$1 and code like '4.1%' limit 1`,
    [companyId]
  );
  accountDespesa = d.rows[0].id;
});

after(async () => {
  await pool?.end();
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.end();
});

async function novoVeiculo(slug) {
  const { rows } = await pool.query(
    `insert into vehicles (slug, brand, model, year, price)
     values ($1,'Audi','Q5',2022,200000) returning id`,
    [slug]
  );
  return rows[0].id;
}

async function lancar(vehicleId, tipo, valor) {
  await pool.query(
    `insert into fin.transactions
       (company_id, account_id, vehicle_id, type, amount, status, competencia)
     values ($1,$2,$3,$4,$5,'confirmed',current_date)`,
    [companyId, tipo === "revenue" ? accountReceita : accountDespesa, vehicleId, tipo, valor]
  );
}

test("lançamento nasce carimbado com o ciclo do veículo", async () => {
  const id = await novoVeiculo("q5-fin-carimbo");
  await pool.query(`update vehicles set ciclo = 2 where id = $1`, [id]);
  await lancar(id, "expense", 100000);
  const { rows } = await pool.query(
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
  await pool.query(`update vehicles set ciclo = 2 where id = $1`, [id]);
  await lancar(id, "expense", 130000);

  const { rows } = await pool.query(CONSULTA_MARGEM);
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
  const { rows } = await pool.query(CONSULTA_MARGEM);
  const doCarro = rows.filter((r) => r.vehicle_id === id);

  assert.equal(doCarro.length, 1, "o coalesce cobre o left join sem lançamento");
  assert.equal(doCarro[0].ciclo, 1);
  assert.equal(Number(doCarro[0].receita), 0);
});

test("a view acompanha a mesma agregação da função", async () => {
  const id = await novoVeiculo("q5-fin-view");
  await lancar(id, "expense", 90000);
  await pool.query(`update vehicles set ciclo = 2 where id = $1`, [id]);
  await lancar(id, "expense", 70000);

  const { rows } = await pool.query(
    `select ciclo, custo_total from fin.v_vehicle_margin
      where vehicle_id = $1 order by ciclo`,
    [id]
  );
  assert.equal(rows.length, 2, "a view não pode divergir da função");
  assert.equal(Number(rows[0].custo_total), 90000);
  assert.equal(Number(rows[1].custo_total), 70000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/fin-ciclo-margem.test.mjs`
Expected: FAIL no `before` — `ENOENT ... db/fin-ciclo.sql`

- [ ] **Step 3: Write the fin schema**

Criar `db/fin-ciclo.sql`:

```sql
-- ============================================================================
-- VAMAQ MOTORS — o ciclo do veículo chega ao financeiro.
--
-- POR QUE ISTO NÃO É SÓ RELATÓRIO: getVehicleMargins (src/lib/fin/repositories/
-- finance.js) alimenta src/lib/fiscal/notas.js, de onde sai o `custoAquisicao`
-- que vira a BASE DO ICMS da nota de venda. Num carro que voltou na troca,
-- somar os dois ciclos colocaria o custo da primeira compra na base do imposto
-- da segunda venda — erro silencioso, em nota autorizada pela SEFAZ.
--
-- Aplicar:  psql "$DATABASE_URL_FIN" -f db/fin-ciclo.sql   (re-aplicável)
-- Depende de: fin-schema.sql e db/estoque-ciclo.sql (vehicles.ciclo).
-- ============================================================================

alter table fin.transactions add column if not exists ciclo int not null default 1;

create index if not exists tx_vehicle_ciclo_idx
  on fin.transactions(vehicle_id, ciclo) where vehicle_id is not null;

-- Mesmo carimbo por trigger das notas: vehicle_id aqui é OPCIONAL (despesa da
-- loja não é de carro nenhum), por isso o `if not null` dentro da função.
create or replace function fin.carimba_ciclo_do_veiculo() returns trigger as $$
begin
  if new.vehicle_id is not null then
    select v.ciclo into new.ciclo from public.vehicles v where v.id = new.vehicle_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists transactions_carimba_ciclo on fin.transactions;
create trigger transactions_carimba_ciclo
  before insert on fin.transactions
  for each row execute function fin.carimba_ciclo_do_veiculo();

-- A view acompanha a agregação da função, para as duas não divergirem no dia
-- em que alguém finalmente ler a view.
create or replace view fin.v_vehicle_margin as
  select
    v.id as vehicle_id,
    coalesce(t.ciclo, v.ciclo) as ciclo,
    v.ciclo as ciclo_atual,
    v.brand, v.model, v.year, v.placa, v.status,
    coalesce(sum(t.amount) filter (where t.type = 'revenue'), 0) as receita,
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0) as custo_total,
    coalesce(sum(t.amount) filter (where t.type = 'revenue'), 0)
      - coalesce(sum(t.amount) filter (where t.type = 'expense'), 0) as resultado
  from public.vehicles v
  left join fin.transactions t
    on t.vehicle_id = v.id and t.status in ('confirmed', 'reconciled')
  group by v.id, coalesce(t.ciclo, v.ciclo), v.ciclo,
           v.brand, v.model, v.year, v.placa, v.status;
```

Em `db/fin-schema.sql`, na definição da view (linha 195), acrescentar acima dela o aviso:

```sql
-- ATENÇÃO: a forma corrente desta view está em db/fin-ciclo.sql, que a recria
-- agrupando TAMBÉM por ciclo. Mexeu aqui? Mexa lá — fin-ciclo.sql é aplicado
-- depois e vence.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/fin-ciclo-margem.test.mjs`
Expected: PASS — 4 testes.

- [ ] **Step 5: Levar o ciclo para `getVehicleMargins`**

Em `src/lib/fin/repositories/finance.js`, trocar a consulta (linhas 246-257) por:

```js
  const { rows } = await finQuery(
    `select v.id as vehicle_id,
            coalesce(t.ciclo, v.ciclo) as ciclo,
            v.ciclo as ciclo_atual,
            v.brand, v.model, v.year, v.placa, v.status,
            coalesce(sum(t.amount) filter (where t.type='revenue'), 0) as receita,
            coalesce(sum(t.amount) filter (where t.type='expense'), 0) as custo_total,
            coalesce(sum(t.amount) filter (where t.type='expense' and a.code like '4.1%'), 0) as custo_aquisicao
       from public.vehicles v
       left join fin.transactions t on t.vehicle_id = v.id and t.status in ('confirmed','reconciled')
       left join fin.chart_of_accounts a on a.id = t.account_id
      -- Uma linha por (carro, ciclo): o carro que voltou na troca é uma nova
      -- aquisição, com custo próprio. Somar os ciclos poria o custo da primeira
      -- compra na base do ICMS da segunda venda (ver notas.js).
      group by v.id, coalesce(t.ciclo, v.ciclo), v.ciclo, v.brand, v.model, v.year, v.placa, v.status
      ${onlyWithActivity ? "having coalesce(sum(t.amount),0) <> 0" : ""}
      order by (coalesce(sum(t.amount) filter (where t.type='revenue'),0) - coalesce(sum(t.amount) filter (where t.type='expense'),0)) desc`
  );
```

E no `map` do retorno (linha 266), acrescentar os dois campos logo depois de `vehicle_id`:

```js
      vehicle_id: r.vehicle_id, ciclo: Number(r.ciclo), ciclo_atual: Number(r.ciclo_atual),
      brand: r.brand, model: r.model, year: r.year,
```

- [ ] **Step 6: Consertar o placar de saúde**

Em `src/lib/fin/repositories/finance.js:609`, trocar:

```js
    const vendidosComValor = margens.filter((m) => m.status === "vendido" && m.receita > 0);
```

por:

```js
    // `status` é o do carro HOJE. Um carro que voltou na troca está
    // `disponivel` no ciclo 2, e a venda do ciclo 1 sumiria da conta — mas todo
    // ciclo já encerrado terminou numa venda, por definição.
    const vendidosComValor = margens.filter(
      (m) => (m.status === "vendido" || m.ciclo < m.ciclo_atual) && m.receita > 0
    );
```

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: 0 fail. Atenção especial a `tests/fin-*.test.mjs` — se algum deles casava margem por `vehicle_id` só, ele vai quebrar aqui e é exatamente o que este passo tem que revelar.

- [ ] **Step 8: Commit**

```bash
sudo -n -u lorrayneparaiso git add db/fin-ciclo.sql db/fin-schema.sql src/lib/fin/repositories/finance.js tests/fin-ciclo-margem.test.mjs
sudo -n -u lorrayneparaiso git commit -m "feat: a margem por veículo passa a ser por ciclo

Não é só relatório: getVehicleMargins alimenta notas.js, de onde sai o
custoAquisicao que vira a BASE DO ICMS da nota de venda. Num carro em segundo
ciclo, somar os dois poria o custo da primeira compra na base do imposto da
segunda venda — erro silencioso, em nota autorizada pela SEFAZ.

O placar de saúde acompanha: status é o do carro hoje, e um ciclo encerrado
terminou em venda por definição.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: A escrita do retorno

**Files:**
- Modify: `src/lib/vehicleStore.js:178-206` (`setVehicleStatus` ganha `republicar`), e acrescentar `retornarAoEstoque` logo abaixo
- Test: `tests/estoque-retorno-store.test.mjs`

**Interfaces:**
- Consumes: `podeRetornarAoEstoque` (Task 1), `vehicles.ciclo` e `vehicle_ciclos` (Task 2).
- Produces:
  - `setVehicleStatus(id, status, { republicar = false } = {})` — terceiro argumento novo, opcional; sem ele o comportamento é o de hoje.
  - `retornarAoEstoque(id, userId) -> { ok: true, vehicle } | { error: string }`.

- [ ] **Step 1: Write the failing test**

Criar `tests/estoque-retorno-store.test.mjs`:

```js
/**
 * A escrita do retorno ao estoque, contra Postgres real.
 *
 * O que se protege aqui é o que NÃO dá para ver na tela: o ciclo que incrementa,
 * o histórico que fica, as datas que zeram e o carro que volta ao site.
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
  for (const file of ["schema.sql", "auth-schema.sql", "fiscal-schema.sql", "estoque-ciclo.sql"]) {
    await pool.query(await readFile(path.join(ROOT, "db", file), "utf8"));
  }
});

after(async () => {
  await pool?.end();
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.end();
});

// Importado DEPOIS do before: o módulo lê DATABASE_URL ao montar o pool.
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/estoque-retorno-store.test.mjs`
Expected: FAIL — `retornarAoEstoque is not a function`

- [ ] **Step 3: Implement**

Em `src/lib/vehicleStore.js`, trocar a assinatura e o corpo de `setVehicleStatus`:

```js
// Ciclo de vida por status (PR-C do ADR-002). Substitui a exclusão na UI:
// 'vendido'/'inativo' também saem do site (published=false) na mesma operação,
// preservando o histórico do veículo. Retorna o veículo atualizado ou null.
//
// `republicar` existe porque devolver um carro ao estoque não republicava: esta
// função só mexia em `published` para TIRAR do ar, e "Reativar" devolvia o carro
// ao estoque mas não ao site, sem avisar ninguém. Não vira automático em toda
// volta para `disponivel` porque o cadastro tem uma caixa `published` própria
// (estoque/novo/page.js) — "disponível e fora do site" é um estado que alguém
// escolhe. Só as ações em que a pessoa declarou a intenção passam `true`.
export async function setVehicleStatus(id, status, { republicar = false } = {}) {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL ausente');
  if (!VEHICLE_STATUSES.includes(status)) {
    throw new Error(`Status inválido: ${status}`);
  }
  // vendido/inativo somem do site; disponível/reservado não mexem em published.
  const unpublish = status === 'vendido' || status === 'inativo';
  // Sair do site vence o republicar: "marcar vendido" não pode pôr no ar.
  const publicar = republicar && !unpublish;
  const { rows } = await pool.query(
    `update vehicles
        set status = $2,
            published = case
              when $3 then false
              when $4 then true
              else published
            end,
            data_saida = case
              when $2 = 'vendido' then coalesce(data_saida, current_date)
              else data_saida
            end
      where id = $1
      returning ${SELECT_COLS}`,
    [id, status, unpublish, publicar]
  );
  return rows.length ? rowToVehicle(rows[0]) : null;
}
```

Acrescentar `ciclo` à lista `SELECT_COLS` (topo do arquivo), depois de `status`:

```js
  opcionais, blindagem, images, specs, description, published, status, ciclo,
```

E acrescentar, logo depois de `setVehicleStatus`:

```js
/**
 * O carro vendido volta ao estoque, abrindo um ciclo novo.
 *
 * É o caso do carro que a Vamaq vendeu e recebeu de VOLTA como parte do
 * pagamento de outro (Mayra, 17/09/2026). Fiscalmente é uma nova aquisição:
 * nota de entrada própria, custo próprio, e a próxima nota de venda cita ESSA
 * entrada — por isso um ciclo novo, e não só um status trocado.
 *
 * Tudo numa transação com `for update`: o histórico e os quatro campos do
 * veículo têm que cair juntos, e dois cliques simultâneos abririam dois ciclos.
 * Por isso também não reusa setVehicleStatus, que abriria a própria transação.
 */
export async function retornarAoEstoque(id, userId) {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL ausente');

  const client = await pool.connect();
  try {
    await client.query('begin');

    const atual = await client.query(
      `select id, status, ciclo, data_entrada, data_saida, price
         from vehicles where id = $1 for update`,
      [id]
    );
    if (!atual.rows.length) {
      await client.query('rollback');
      return { error: 'Veículo não encontrado.' };
    }
    // Mesma regra do botão na lista — reconferida aqui porque a rota é
    // alcançável fora dela (link salvo, histórico do navegador).
    if (!podeRetornarAoEstoque(atual.rows[0])) {
      await client.query('rollback');
      return {
        error: 'Só um veículo vendido volta ao estoque. Este está como ' +
          `"${atual.rows[0].status}".`,
      };
    }

    const v = atual.rows[0];
    // O ciclo que fecha vai para o histórico ANTES de as colunas serem
    // reescritas: data_entrada e data_saida são uma só de cada, e sem isto a
    // compra original sumiria do relatório de entradas e saídas.
    await client.query(
      `insert into vehicle_ciclos
         (vehicle_id, ciclo, data_entrada, data_saida, price, encerrado_por)
       values ($1,$2,$3,$4,$5,$6)`,
      [id, v.ciclo, v.data_entrada, v.data_saida, v.price, userId || null]
    );

    // A entrada é HOJE: é a data da nova aquisição, e é dela que a coluna
    // "Qtd dias" da lista de estoque passa a contar. O preço fica como estava —
    // é ponto de partida para reprecificar, não um número a adivinhar.
    const { rows } = await client.query(
      `update vehicles
          set ciclo = ciclo + 1,
              status = 'disponivel',
              published = true,
              data_entrada = current_date,
              data_saida = null
        where id = $1
        returning ${SELECT_COLS}`,
      [id]
    );

    await client.query('commit');
    return { ok: true, vehicle: rowToVehicle(rows[0]) };
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
```

E no topo do arquivo, junto dos outros imports:

```js
import { podeRetornarAoEstoque } from '@/lib/estoque/retornoVeiculo';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/estoque-retorno-store.test.mjs`
Expected: PASS — 10 testes.

Se falhar no import de `@/lib/estoque/retornoVeiculo` (o alias não resolve em `node --test`), conferir se `tests/helpers/mock-session-loader.mjs` precisa ser registrado neste teste, como fazem `tests/contrato-forma-pagamento.test.mjs` e irmãos:

```js
import { register } from "node:module";
import { pathToFileURL } from "node:url";
register("./tests/helpers/mock-session-loader.mjs", pathToFileURL("./"));
```

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: 0 fail. `setVehicleStatus` ganhou um parâmetro **opcional**, então nenhuma chamada existente muda de comportamento — se algum teste quebrar aqui, é sinal de que a mudança não ficou retrocompatível.

- [ ] **Step 6: Commit**

```bash
sudo -n -u lorrayneparaiso git add src/lib/vehicleStore.js tests/estoque-retorno-store.test.mjs
sudo -n -u lorrayneparaiso git commit -m "feat: o carro vendido volta ao estoque abrindo um ciclo novo

Numa transação com for update: o histórico e os quatro campos do veículo caem
juntos, e dois cliques simultâneos abririam dois ciclos.

Junto, o conserto do published: setVehicleStatus só mexia nele para TIRAR do
ar, então Reativar devolvia o carro ao estoque mas não ao site. Vira parâmetro
opcional em vez de automático — o cadastro tem caixa published própria, e
'disponível e fora do site' é um estado que alguém escolhe.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: As guardas fiscais por ciclo

**Files:**
- Modify: `src/lib/fiscal/notas.js:40-44` (select do veículo), `:51-56` (casamento da margem), `:66-82` (as duas consultas de `getDadosEmissao`), `:377-382` (guarda da entrada), `:483-487` (devolução de consignação)
- Test: `tests/fiscal-ciclo.test.mjs`

**Interfaces:**
- Consumes: `vehicles.ciclo`, `notas_fiscais.ciclo` (Task 2); `getVehicleMargins` com `ciclo`/`ciclo_atual` (Task 3).
- Produces: nada novo para fora — `getDadosEmissao` passa a devolver também `veiculo.ciclo`.

**O ponto mais perigoso do plano.** A consulta de `numeroNotaEntrada` (`:76`) alimenta o texto obrigatório da nota de venda (*"VEICULO USADO ADQ DE ... CF NF 10"*). Sem o filtro por ciclo, a nota da segunda venda sai **autorizada citando a compra errada**.

- [ ] **Step 1: Write the failing test**

Criar `tests/fiscal-ciclo.test.mjs`:

```js
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
  for (const file of ["schema.sql", "auth-schema.sql", "fiscal-schema.sql", "estoque-ciclo.sql"]) {
    await pool.query(await readFile(path.join(ROOT, "db", file), "utf8"));
  }
  await pool.query(
    `insert into fiscal_config (cnpj) values ('45348469000154')
       on conflict do nothing`
  );
});

after(async () => {
  await pool?.end();
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.end();
});

const { getDadosEmissao } = await import("../src/lib/fiscal/notas.js");

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/fiscal-ciclo.test.mjs`
Expected: FAIL — "a nota de saída do ciclo 1 não bloqueia a venda do ciclo 2" e "a nota de venda do ciclo 2 cita a entrada DO CICLO 2" falham; os testes do ciclo 1 já passam.

- [ ] **Step 3: Implement**

Em `src/lib/fiscal/notas.js`, no select de `getDadosEmissao` (linha 40), acrescentar `ciclo`:

```js
  const v = await query(
    `select id, brand, model, year, price, placa, chassi, status, ciclo
       from vehicles where id = $1`,
    [vehicleId]
  );
  if (!v.rows.length) return null;
  const ciclo = v.rows[0].ciclo;
```

No casamento da margem (linha 51), casar por veículo **e** ciclo:

```js
    const margens = await getVehicleMargins({ onlyWithActivity: false });
    // Por veículo E ciclo: o carro que voltou na troca tem uma linha por
    // negociação, e o custo da primeira compra não pode virar base do ICMS da
    // segunda venda.
    const m = margens.find((x) => x.vehicle_id === vehicleId && x.ciclo === ciclo);
```

Nas duas consultas seguintes (linhas 66 e 76), acrescentar o filtro:

```js
  const { rows: notasAtivas } = await query(
    `select ref, status from notas_fiscais
      where vehicle_id = $1 and operacao = 'saida' and ciclo = $2
        and status in ('processando','autorizada')
      order by created_at desc limit 1`,
    [vehicleId, ciclo]
  );

  const { rows: entrada } = await query(
    `select numero from notas_fiscais
      where vehicle_id = $1 and operacao = 'entrada' and ciclo = $2
        and status = 'autorizada' and numero is not null
      order by created_at desc limit 1`,
    [vehicleId, ciclo]
  );
```

Na guarda da entrada (linha 378), usar o ciclo que `getDadosEmissao` já trouxe:

```js
  const { rows: existentes } = await query(
    `select ref, status from notas_fiscais
      where vehicle_id=$1 and operacao='entrada' and ciclo=$2
        and status in ('processando','autorizada')`,
    [vehicleId, dados.veiculo.ciclo]
  );
```

Na devolução de consignação (linha 484):

```js
  const { rows: entradas } = await query(
    `select ref, valor, destinatario from notas_fiscais
      where vehicle_id=$1 and operacao='entrada' and status='autorizada'
        and ciclo=$3 and cfop = any($2)
      order by created_at desc limit 1`,
    [vehicleId, CFOP_CONSIGNACAO_RECEBIDA, dados.veiculo.ciclo]
  );
```

Acrescentar, acima do bloco das duas consultas de `getDadosEmissao`, o comentário do porquê:

```js
  // TODAS as consultas abaixo são do CICLO CORRENTE. Um carro que voltou na
  // troca tem as notas do ciclo anterior ainda gravadas: sem o filtro, a
  // guarda diria "este veículo já tem nota" e a segunda negociação travaria —
  // e, pior, o número da entrada citado no texto obrigatório da nota de venda
  // seria o da compra de meses atrás, de outro vendedor.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/fiscal-ciclo.test.mjs`
Expected: PASS — 5 testes.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: 0 fail. Os testes fiscais existentes (`tests/fiscal-*.test.mjs`) rodam com dados no ciclo 1; se algum quebrar, o filtro não ficou retrocompatível.

- [ ] **Step 6: Commit**

```bash
sudo -n -u lorrayneparaiso git add src/lib/fiscal/notas.js tests/fiscal-ciclo.test.mjs
sudo -n -u lorrayneparaiso git commit -m "fix: as guardas fiscais passam a ser por ciclo do veículo

Sem isso a segunda negociação do carro que voltou na troca trava em 'este
veículo já tem nota de entrada autorizada'.

E o pior, que não travaria nada: o texto obrigatório da nota de venda cita o
número da nota de entrada do veículo. Sem filtro por ciclo, a segunda venda
sairia autorizada citando a compra de meses atrás, de outro vendedor.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: O histórico no relatório de entradas e saídas

**Files:**
- Create: `src/lib/estoque/ciclosDoVeiculo.js`
- Modify: `src/lib/vehicleStore.js` (acrescenta `readCiclosEncerrados`)
- Modify: `src/app/admin/estoque/entradas-saidas/page.js:31-54`
- Modify: `src/app/admin/estoque/entradas-saidas/EntradasSaidasClient.js:166-180`
- Test: `tests/estoque-ciclos-linhas.test.mjs`

**Interfaces:**
- Consumes: `vehicle_ciclos` (Task 2), `getVehicleMargins` com `ciclo` (Task 3).
- Produces:
  - `linhasComCiclos({ veiculos, ciclos, margens }) -> Array<linha>` — uma linha por ciclo, ordenada por carro e ciclo. A linha tem os mesmos campos de hoje mais `ciclo` (int) e `ciclosDoCarro` (int).
  - `readCiclosEncerrados() -> Array<{ vehicle_id, ciclo, data_entrada, data_saida, price }>`.

- [ ] **Step 1: Write the failing test**

Criar `tests/estoque-ciclos-linhas.test.mjs`:

```js
/**
 * O relatório de entradas e saídas mostra TODOS os ciclos do carro.
 *
 * O ciclo corrente vive nas colunas de `vehicles`; os encerrados, em
 * `vehicle_ciclos`. Sem unir os dois, a compra original do carro que voltou na
 * troca desaparece do relatório — e ele é o registro de entrada e saída do pátio.
 *
 *   npm test   (função pura, sem banco)
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { linhasComCiclos } from "../src/lib/estoque/ciclosDoVeiculo.js";

const CARRO = {
  id: "v1", brand: "Audi", model: "Q5", year: 2022, ano_modelo: 2023,
  placa: "ABC1D23", chassi: "9BW", status: "disponivel", ciclo: 2,
  data_entrada: "2026-09-17", data_saida: null,
};

test("carro em ciclo único dá uma linha, como antes", () => {
  const linhas = linhasComCiclos({
    veiculos: [{ ...CARRO, ciclo: 1, data_saida: "2026-06-20" }],
    ciclos: [],
    margens: [],
  });

  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].ciclo, 1);
  assert.equal(linhas[0].data_saida, "2026-06-20");
});

test("carro que voltou na troca dá uma linha por ciclo, na ordem", () => {
  const linhas = linhasComCiclos({
    veiculos: [CARRO],
    ciclos: [
      { vehicle_id: "v1", ciclo: 1, data_entrada: "2026-01-10", data_saida: "2026-06-20", price: 200000 },
    ],
    margens: [],
  });

  assert.equal(linhas.length, 2);
  assert.deepEqual(linhas.map((l) => l.ciclo), [1, 2]);
  assert.equal(linhas[0].data_entrada, "2026-01-10", "a compra original não pode sumir");
  assert.equal(linhas[0].data_saida, "2026-06-20");
  assert.equal(linhas[1].data_entrada, "2026-09-17");
  assert.equal(linhas[1].data_saida, null);
});

test("cada linha casa a margem do seu ciclo", () => {
  const linhas = linhasComCiclos({
    veiculos: [CARRO],
    ciclos: [{ vehicle_id: "v1", ciclo: 1, data_entrada: "2026-01-10", data_saida: "2026-06-20", price: 200000 }],
    margens: [
      { vehicle_id: "v1", ciclo: 1, custo_aquisicao: 150000, receita: 200000, resultado_liquido: 40000 },
      { vehicle_id: "v1", ciclo: 2, custo_aquisicao: 180000, receita: 0, resultado_liquido: -180000 },
    ],
  });

  assert.equal(linhas[0].compra, 150000);
  assert.equal(linhas[0].venda, 200000);
  assert.equal(linhas[1].compra, 180000);
  assert.equal(linhas[1].venda, null, "zero não é valor — ausência aparece como ausência");
});

test("carro sem lançamento não mostra R$ 0,00 na coluna Compra", () => {
  const linhas = linhasComCiclos({
    veiculos: [{ ...CARRO, ciclo: 1 }],
    ciclos: [],
    margens: [{ vehicle_id: "v1", ciclo: 1, custo_aquisicao: 0, receita: 0, resultado_liquido: 0 }],
  });

  assert.equal(linhas[0].compra, null);
  assert.equal(linhas[0].venda, null);
  assert.equal(linhas[0].resultado, null);
});

test("a linha diz quantos ciclos o carro tem, para a tela poder marcar", () => {
  const linhas = linhasComCiclos({
    veiculos: [CARRO],
    ciclos: [{ vehicle_id: "v1", ciclo: 1, data_entrada: "2026-01-10", data_saida: "2026-06-20", price: 200000 }],
    margens: [],
  });

  assert.equal(linhas[0].ciclosDoCarro, 2);
  assert.equal(linhas[1].ciclosDoCarro, 2);
});

test("ciclo de outro carro não vaza para este", () => {
  const linhas = linhasComCiclos({
    veiculos: [{ ...CARRO, ciclo: 1 }],
    ciclos: [{ vehicle_id: "OUTRO", ciclo: 1, data_entrada: "2026-01-10", data_saida: "2026-06-20", price: 9 }],
    margens: [],
  });

  assert.equal(linhas.length, 1);
});

test("sem veículo nenhum devolve lista vazia", () => {
  assert.deepEqual(linhasComCiclos({ veiculos: [], ciclos: [], margens: [] }), []);
  assert.deepEqual(linhasComCiclos({}), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/estoque-ciclos-linhas.test.mjs`
Expected: FAIL — `Cannot find module '.../src/lib/estoque/ciclosDoVeiculo.js'`

- [ ] **Step 3: Implement**

Criar `src/lib/estoque/ciclosDoVeiculo.js`:

```js
/**
 * As linhas do relatório de entradas e saídas, um ciclo por linha.
 *
 * O ciclo CORRENTE do carro vive nas colunas de `vehicles` (data_entrada,
 * data_saida, price); os ENCERRADOS, em `vehicle_ciclos`. Sem unir os dois, a
 * compra original do carro que voltou na troca desaparece do relatório — e ele
 * é justamente o registro de entrada e saída do pátio.
 *
 * Puro de propósito: sem banco e sem alias "@/", para rodar em `node --test`.
 * Mesmo padrão de src/lib/estoque/listaVeiculos.js.
 */

/** "2026-01-10" a partir de Date ou string; null vira null. */
function dia(valor) {
  return valor ? String(valor).slice(0, 10) : null;
}

/**
 * Zero NÃO é valor: a margem devolve 0 para carro sem lançamento nenhum, e
 * "R$ 0,00" na coluna Compra se lê como "comprado de graça". Ausência de
 * lançamento tem que aparecer como ausência. (Regra herdada da versão anterior
 * desta tela — não relaxar.)
 */
function valorOuNulo(n) {
  return n > 0 ? n : null;
}

export function linhasComCiclos({ veiculos, ciclos, margens } = {}) {
  const carros = Array.isArray(veiculos) ? veiculos : [];
  const encerrados = Array.isArray(ciclos) ? ciclos : [];
  const margem = new Map(
    (Array.isArray(margens) ? margens : []).map((m) => [`${m.vehicle_id}|${m.ciclo}`, m])
  );

  const linhas = [];
  for (const v of carros) {
    const cicloAtual = Number(v.ciclo) || 1;
    const meus = encerrados
      .filter((c) => c.vehicle_id === v.id)
      .sort((a, b) => a.ciclo - b.ciclo);
    const total = meus.length + 1;

    const monta = (ciclo, dataEntrada, dataSaida) => {
      const m = margem.get(`${v.id}|${ciclo}`);
      const compra = m ? valorOuNulo(m.custo_aquisicao) : null;
      const venda = m ? valorOuNulo(m.receita) : null;
      return {
        id: v.id,
        ciclo,
        ciclosDoCarro: total,
        brand: v.brand,
        model: v.model,
        year: v.year,
        ano_modelo: v.ano_modelo,
        placa: v.placa,
        chassi: v.chassi,
        // O status é o do carro HOJE; num ciclo encerrado ele não descreve
        // aquele ciclo, e por isso a tela só o usa na linha corrente.
        status: v.status,
        data_entrada: dia(dataEntrada),
        data_saida: dia(dataSaida),
        compra,
        venda,
        resultado: compra !== null || venda !== null ? m.resultado_liquido : null,
      };
    };

    for (const c of meus) linhas.push(monta(c.ciclo, c.data_entrada, c.data_saida));
    linhas.push(monta(cicloAtual, v.data_entrada, v.data_saida));
  }
  return linhas;
}
```

Em `src/app/admin/estoque/entradas-saidas/page.js`, trocar o bloco `porVeiculo`/`linhas` (linhas 31-54) por:

```js
  // Os ciclos encerrados: sem eles, a compra original do carro que voltou na
  // troca some do relatório que existe justamente para registrar entradas e
  // saídas do pátio.
  let ciclos = [];
  try {
    ciclos = await readCiclosEncerrados();
  } catch {
    // Mesma postura do financeiro acima: a tela cai para o ciclo corrente, que
    // é o que ela já mostrava antes de existir ciclo.
    ciclos = [];
  }

  const linhas = linhasComCiclos({ veiculos, ciclos, margens });
```

E os imports no topo:

```js
import { readVehicles, readCiclosEncerrados } from "@/lib/vehicleStore";
import { linhasComCiclos } from "@/lib/estoque/ciclosDoVeiculo";
```

Acrescentar em `src/lib/vehicleStore.js`, depois de `retornarAoEstoque`:

```js
/** Os ciclos já encerrados de todos os carros — o passado do pátio. */
export async function readCiclosEncerrados() {
  const pool = getPool();
  if (!pool) return [];
  const { rows } = await pool.query(
    `select vehicle_id, ciclo, data_entrada, data_saida, price
       from vehicle_ciclos order by vehicle_id, ciclo`
  );
  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/estoque-ciclos-linhas.test.mjs`
Expected: PASS — 7 testes.

- [ ] **Step 5: Consertar a `key` da tabela — o defeito que este trabalho introduz**

Em `src/app/admin/estoque/entradas-saidas/EntradasSaidasClient.js:166`, a linha é `<tr key={v.id}>`. Com mais de um ciclo por carro, **`v.id` deixa de ser único** e o React passa a reaproveitar linha errada ao reordenar ou filtrar. Trocar por:

```jsx
                  {lista.map((v) => (
                    <tr key={`${v.id}|${v.ciclo}`}>
```

- [ ] **Step 6: Mostrar o ciclo na tela**

No mesmo arquivo, dentro da primeira `<td>`, logo depois do `<span>` da placa (linha ~174), acrescentar a marca de passagem — senão o mesmo carro parece repetido por engano. A variável do `map` é `v`, e `styles` é `../../admin.module.css`, a mesma folha que já define `badgeWarning` (usada em `EstoqueClient.js`):

```jsx
                        {v.ciclosDoCarro > 1 && (
                          <span
                            className={styles.badgeWarning}
                            style={{ background: "#e0e7ff", color: "#3730a3" }}
                            title={`Este carro passou pela loja ${v.ciclosDoCarro} vezes — esta linha é a ${v.ciclo}ª`}
                          >
                            {v.ciclo}ª passagem
                          </span>
                        )}
```

O `status` também merece cuidado: `STATUS_ROTULO[v.status]` é o status de **hoje**, e numa linha de ciclo encerrado ele descreve o carro agora, não aquele ciclo. Trocar a célula de status (linha ~178) para dizer a verdade nas duas:

```jsx
                      <td>
                        {v.ciclo < v.ciclosDoCarro
                          ? "Vendido"
                          : STATUS_ROTULO[v.status] || v.status}
                      </td>
```

- [ ] **Step 7: Run the full suite + build**

Run: `npm test && npm run build`
Expected: 0 fail; `✓ Compiled successfully`.

- [ ] **Step 8: Commit**

```bash
sudo -n -u lorrayneparaiso git add src/lib/estoque/ciclosDoVeiculo.js src/lib/vehicleStore.js src/app/admin/estoque/entradas-saidas/ tests/estoque-ciclos-linhas.test.mjs
sudo -n -u lorrayneparaiso git commit -m "feat: o relatório de entradas e saídas mostra todos os ciclos do carro

O ciclo corrente vive nas colunas de vehicles; os encerrados, em
vehicle_ciclos. Sem unir os dois, a compra original do carro que voltou na
troca sumiria do relatório que existe para registrar entrada e saída do pátio.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: O botão "Voltar ao estoque"

**Files:**
- Modify: `src/app/api/admin/vehicles/[id]/route.js` (PATCH aceita a ação de retorno)
- Modify: `src/app/admin/estoque/EstoqueClient.js` (import, função `retornar`, botão nas duas listas)
- Modify: `src/app/admin/tutoriais/estoque/page.js` (passo novo)
- Test: `tests/vehicles-autorizacao.test.mjs` (acrescentar o caso do retorno)

**Interfaces:**
- Consumes: `podeRetornarAoEstoque` (Task 1), `retornarAoEstoque` (Task 4).
- Produces: `PATCH /api/admin/vehicles/[id]` com corpo `{ acao: "retornar-ao-estoque" }`.

- [ ] **Step 1: Write the failing test**

Em `tests/vehicles-autorizacao.test.mjs`, acrescentar ao array `ROTAS`, logo depois da entrada `"PATCH /vehicles/[id] (marcar vendido / desativar / reativar)"`:

```js
  {
    nome: "PATCH /vehicles/[id] (voltar ao estoque)",
    permitidos: ["estoque", "financeiro", "vendedor", "secretaria", "admin"],
    chamar: () =>
      vehicleIdRoute.PATCH(
        reqJson(`http://localhost/api/admin/vehicles/${UUID}`, "PATCH", {
          acao: "retornar-ao-estoque",
        }),
        ctxComId()
      ),
  },
```

O arquivo é dirigido por tabela: o laço no fim já gera um teste por papel, então esta entrada sozinha acrescenta 5 testes. Sem `DATABASE_URL`, `retornarAoEstoque` lança `"DATABASE_URL ausente"`, o `try/catch` do PATCH devolve 400, e o teste só afirma "não é 403" — exatamente o contrato que o cabeçalho do arquivo descreve.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/vehicles-autorizacao.test.mjs`
Expected: FAIL nos 5 casos novos — a rota ainda não conhece `acao`, então ela cai em `setVehicleStatus(id, undefined)`, que lança `Status inválido: undefined` e devolve 400. O teste de "passa da guarda" passaria por acidente; para que ele falhe de verdade agora, conferir que a asserção usada é a do arquivo (`notEqual 403`) e que o caso novo aparece na saída. Se os 5 já passarem neste ponto, seguir assim mesmo: o valor deles é travar a lista de papéis contra regressão futura, como o próprio cabeçalho do arquivo explica.

- [ ] **Step 3: Rota**

Em `src/app/api/admin/vehicles/[id]/route.js`, importar `retornarAoEstoque` junto dos outros e, no início do `try` do PATCH, desviar antes da leitura de `status`:

```js
    const { id } = await params;
    const { status, clienteId, acao } = await request.json();

    // Retorno ao estoque é ação própria, não um status: ela abre um ciclo novo
    // e grava o anterior no histórico, o que `setVehicleStatus` não faz.
    if (acao === "retornar-ao-estoque") {
      const r = await retornarAoEstoque(id, auth.user?.id || null);
      if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });

      revalidatePath('/');
      revalidatePath('/acervo');
      if (r.vehicle.slug) revalidatePath(`/veiculo/${r.vehicle.slug}`);
      return NextResponse.json(r.vehicle);
    }

    const updated = await setVehicleStatus(id, status);
```

`auth.user.id` é o campo certo: `requireApiRole` (`src/lib/auth/api.js:32`) devolve `{ user }` no caminho feliz e `{ error }` nos outros — confirmado.

- [ ] **Step 4: Tela**

Em `src/app/admin/estoque/EstoqueClient.js`, importar a regra:

```js
import { podeRetornarAoEstoque } from "@/lib/estoque/retornoVeiculo";
```

Acrescentar a função, ao lado de `setStatus`:

```js
  // Retorno ao estoque do carro que a Vamaq vendeu e recebeu de volta na troca.
  // O aviso diz a parte FISCAL de propósito: é a informação que a operadora não
  // tem como adivinhar, e a que custa caro quando falta.
  async function retornarAoEstoque(id) {
    if (
      !confirm(
        "Voltar este carro ao estoque?\n\n" +
          "Ele volta como DISPONÍVEL e volta para o site, com entrada de hoje. " +
          "A venda anterior fica no histórico.\n\n" +
          "A próxima venda vai exigir uma NOVA nota de entrada."
      )
    )
      return;
    const res = await fetch(`/api/admin/vehicles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "retornar-ao-estoque" }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Não deu para voltar o carro ao estoque. Tente de novo.");
      return;
    }
    setRefreshKey((k) => k + 1);
  }
```

E o botão, nas **duas** listas (a tabela, junto do bloco `v.status === "vendido" && podeEmitirNota` na linha ~308, e os cards, no bloco equivalente na linha ~384), logo depois do "Emitir nota":

```jsx
{podeRetornarAoEstoque(v) && (
  <button
    type="button"
    onClick={() => retornarAoEstoque(v.id)}
    className={`${styles.btnSecondary} ${styles.btnSmall}`}
    style={{ minHeight: 48 }}
  >
    Voltar ao estoque
  </button>
)}
```

- [ ] **Step 5: Reativar passa a republicar**

Ainda em `EstoqueClient.js`, `setStatus` ganha o repasse do parâmetro, e o `StatusButton` do "Reativar" passa a pedi-lo:

```js
  async function setStatus(id, status, confirmMsg, republicar = false) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    await fetch(`/api/admin/vehicles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, republicar }),
    });
    setRefreshKey((k) => k + 1);
  }
```

No `StatusButton` (linha ~408):

```jsx
      <button
        onClick={() => onSet(vehicle.id, "disponivel", null, true)}
        className={styles.btnSecondary}
      >
        Reativar
      </button>
```

E na rota, repassar:

```js
    const { status, clienteId, acao, republicar } = await request.json();
    ...
    const updated = await setVehicleStatus(id, status, { republicar: Boolean(republicar) });
```

- [ ] **Step 6: O aviso de passagem na ficha do veículo**

A spec pede que a ficha mostre os ciclos quando `ciclo > 1`. Não existe ficha separada: `/admin/estoque/novo?id=<id>` é o formulário de edição e faz as vezes dela — já traz o bloco "Contratos gerados" (`src/app/admin/estoque/novo/page.js:889`).

O veículo carregado ali já tem `ciclo` (entrou em `SELECT_COLS` na Task 4), então **não é preciso buscar nada**. Acrescentar, logo acima do bloco de contratos gerados, um aviso de uma linha:

```jsx
{Number(form.ciclo) > 1 && (
  <div
    className={styles.card}
    style={{ borderLeft: "4px solid #3730a3", background: "#eef2ff", marginBottom: 20 }}
  >
    <strong>Este carro já passou pela loja {form.ciclo} vezes.</strong>
    <p style={{ margin: "6px 0 0", fontSize: "0.9rem", color: "#333" }}>
      A data de entrada abaixo é a da passagem atual. As anteriores, com datas e
      valores, estão em{" "}
      <Link href="/admin/estoque/entradas-saidas">Entradas e saídas</Link>.
    </p>
  </div>
)}
```

Conferir, ao editar, que `form` é mesmo o nome do estado do veículo nesse arquivo e que `Link` já está importado; se o estado guardar só os campos do formulário e não o `ciclo`, incluir `ciclo` no objeto inicial carregado do veículo — sem valor padrão diferente de 1.

- [ ] **Step 7: Tutorial**

Em `src/app/admin/tutoriais/estoque/page.js`, depois do passo 8 ("Vendeu? Marque a venda"), acrescentar um passo novo com a numeração seguinte — **conferir os números existentes antes e renumerar o que vier depois**, como já foi feito no tutorial de Documentos. Conteúdo:

- título: *"O carro voltou na troca? Volte ele ao estoque"*;
- o botão **Voltar ao estoque** aparece na linha do carro vendido;
- o carro volta como **Disponível**, volta para o site e a entrada passa a ser **hoje** — a contagem de dias no pátio recomeça, porque é uma compra nova;
- a venda anterior **fica no histórico**, visível em Entradas e saídas como "1ª passagem";
- em destaque (`t.warning`): **a próxima venda exige uma nova nota de entrada** — fiscalmente o carro que volta é uma nova aquisição, e a nota da nova venda vai citar essa nova entrada;
- **não** use isto para desfazer uma venda marcada por engano; para isso, ver o suporte — o retorno grava uma compra no histórico.

- [ ] **Step 8: Run everything**

Run: `npm test && npx eslint src/ && npm run build`
Expected: 0 fail nos testes; nenhum erro NOVO de eslint (o repo já tem 8 erros `react-hooks/set-state-in-effect` pré-existentes, em arquivos não tocados por este trabalho — conferir que os arquivos tocados não aparecem); `✓ Compiled successfully`.

- [ ] **Step 9: Commit**

```bash
sudo -n -u lorrayneparaiso git add src/app/api/admin/vehicles src/app/admin/estoque src/app/admin/tutoriais/estoque tests/vehicles-autorizacao.test.mjs
sudo -n -u lorrayneparaiso git commit -m "feat: botão Voltar ao estoque para o carro que voltou na troca

A confirmação diz a parte fiscal de propósito — que a próxima venda vai exigir
uma nova nota de entrada. É a informação que a operadora não tem como
adivinhar e a que custa caro quando falta.

Reativar passa a republicar: até aqui devolvia o carro ao estoque mas não ao
site.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: O passo a passo de deploy

**Files:**
- Modify: `docs/DEPLOY-POSTGRES-VPS.md`

**Interfaces:**
- Consumes: os dois `.sql` das Tasks 2 e 3.
- Produces: nada em código.

**Por que é uma task e não um recado:** este deploy tem **dois** schemas em **duas conexões diferentes** (`DATABASE_URL` e `DATABASE_URL_FIN`), e a memória do projeto registra que schema esquecido falha de forma **invisível no site público** — a vitrine responde 200 com zero veículos.

- [ ] **Step 1: Escrever a seção**

Acrescentar ao `docs/DEPLOY-POSTGRES-VPS.md` uma seção "Deploy do ciclo de vida do veículo (17/09/2026)" com a ordem exata:

```bash
cd /var/www/vamaq
git pull <origem>                      # ver o procedimento por bundle no doc
psql "$DATABASE_URL"     -f db/estoque-ciclo.sql   # vehicles.ciclo, notas_fiscais.ciclo, vehicle_ciclos
psql "$DATABASE_URL_FIN" -f db/fin-ciclo.sql       # fin.transactions.ciclo + a view
npm install && npm run build
pm2 restart vamaq
git rev-parse --short HEAD             # a única prova de qual commit ficou rodando
```

E o smoke check, que não pode ser só código HTTP:

```bash
curl -s https://vamaqmotors.com.br/acervo | grep -o "Tenho Interesse" | wc -l   # > 0
psql "$DATABASE_URL" -c "select count(*) from vehicles where ciclo <> 1"        # 0 logo após o deploy
```

Registrar o porquê: os dois `.sql` são **obrigatórios e em conexões diferentes**; aplicar só o primeiro deixa `fin.transactions` sem `ciclo`, e a consulta de margem — que alimenta a base do ICMS da nota — falha com `column t.ciclo does not exist`.

- [ ] **Step 2: Commit**

```bash
sudo -n -u lorrayneparaiso git add docs/DEPLOY-POSTGRES-VPS.md
sudo -n -u lorrayneparaiso git commit -m "docs: passo a passo de deploy do ciclo de vida do veículo

Dois schemas em duas conexões diferentes. Aplicar só o do public deixa
fin.transactions sem ciclo, e a consulta de margem — que alimenta a base do
ICMS da nota — quebra.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Ordem e dependências

```
1 (regra pura) ─┐
2 (schema)  ────┼─→ 4 (escrita) ─→ 6 (relatório) ─→ 7 (tela) ─→ 8 (deploy)
                └─→ 3 (financeiro) ─→ 5 (fiscal) ──┘
```

As Tasks 1 e 2 são independentes entre si. A 3 e a 5 são o par de risco — é onde o
imposto e o documento fiscal são tocados; a 5 depende da 3 porque casa a margem por
ciclo. A 7 é a última porque só ela é visível para a Mayra, e não adianta o botão
existir antes de o caminho fiscal atrás dele funcionar.
