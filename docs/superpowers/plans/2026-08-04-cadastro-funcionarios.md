# Cadastro de Funcionários — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar o quadro de pessoal da Vamaq (ficha + passagens pela loja) e ligar cada ficha, opcionalmente, ao login do sistema.

**Architecture:** Duas tabelas novas em `public` (`funcionarios`, `funcionario_vinculos`) e uma coluna `funcionario_id` em `users`. O cargo mora no vínculo, então promoção e readmissão viram histórico. Desligar fecha o vínculo e desativa o login numa única instrução SQL. Telas em `/admin/funcionarios`, restritas a admin.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Postgres via `pg`, CSS Modules (`admin.module.css`), testes com `node:test`.

**Spec:** `docs/superpowers/specs/2026-08-04-cadastro-funcionarios-design.md`

## Global Constraints

- **Leia o guia do Next antes de escrever código**: este Next tem mudanças de API em relação ao seu treino — consulte `node_modules/next/dist/docs/` (regra do `AGENTS.md`).
- **JavaScript puro + CSS Modules.** Sem TypeScript, sem dependência nova.
- **Nomes de tabela e coluna em português**, como `db/crm-schema.sql`. Código e comentários em português.
- **Todo arquivo `.sql` é idempotente** (`create table if not exists`, `add column if not exists`) — é re-aplicado em produção.
- **Toda Server Action começa com `await requireRole("admin")`** (`src/lib/auth/dal.js`).
- **Alias `@/` não resolve em `node --test`.** Módulos que precisam de teste unitário não podem importar `@/lib/db` — por isso o SQL crítico vive em `src/lib/rh/sql.js`, puro.
- **Testes rodam serializados**: `npm test` = `node --test --test-concurrency=1 tests/*.test.mjs`. Testes de banco usam `TEST_ADMIN_URL` (default `postgres://postgres@localhost:5432/postgres`).
- **Commits frequentes**, um por task, mensagem em português no padrão `feat:` / `test:` / `docs:`.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `db/funcionarios-schema.sql` (criar) | As duas tabelas, índices, CHECK e a coluna `users.funcionario_id`. |
| `src/lib/rh/cpf.js` (criar) | Normalizar e validar CPF. Puro, sem I/O. |
| `src/lib/rh/sql.js` (criar) | SQL do desligamento atômico. Puro (só strings) — testável direto. |
| `src/lib/rh/funcionarios.js` (criar) | Regras de negócio: listar, ler, criar, editar, admitir, desligar. |
| `src/lib/auth/users.js` (modificar) | `listUsers` com o funcionário; `createUser` aceita ficha; `setUserFuncionario`. |
| `src/lib/auth/permissions.js` (modificar) | Seção `funcionarios` no menu, só admin. |
| `src/app/admin/funcionarios/page.js` (criar) | Server Component: carrega a lista. |
| `src/app/admin/funcionarios/actions.js` (criar) | Server Actions da lista e da ficha. |
| `src/app/admin/funcionarios/FuncionariosClient.js` (criar) | Lista + formulário de nova ficha. |
| `src/app/admin/funcionarios/[id]/page.js` (criar) | Server Component: carrega uma ficha. |
| `src/app/admin/funcionarios/[id]/FichaClient.js` (criar) | Dados pessoais, passagens, desligar/readmitir, acesso. |
| `src/app/admin/usuarios/*` (modificar) | Coluna Funcionário e seletor de vínculo. |
| `tests/rh-cpf.test.mjs` (criar) | Validação de CPF. |
| `tests/rh-schema.test.mjs` (criar) | Contrato do schema + desligamento atômico contra Postgres real. |

---

### Task 1: Validação de CPF

**Files:**
- Create: `src/lib/rh/cpf.js`
- Test: `tests/rh-cpf.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `normalizeCpf(value) -> string` (só dígitos, `""` se vazio) e `isValidCpf(value) -> boolean`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/rh-cpf.test.mjs`:

```js
/**
 * Validação de CPF (ficha do funcionário). Puro — sem banco.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCpf, isValidCpf } from "../src/lib/rh/cpf.js";

test("normalizeCpf tira pontuação e espaços", () => {
  assert.equal(normalizeCpf(" 529.982.247-25 "), "52998224725");
  assert.equal(normalizeCpf(null), "");
  assert.equal(normalizeCpf(undefined), "");
});

test("isValidCpf aceita CPF válido, com ou sem máscara", () => {
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("52998224725"), true);
});

test("isValidCpf rejeita dígito verificador errado", () => {
  assert.equal(isValidCpf("529.982.247-24"), false);
});

test("isValidCpf rejeita sequências repetidas e tamanho errado", () => {
  assert.equal(isValidCpf("111.111.111-11"), false);
  assert.equal(isValidCpf("00000000000"), false);
  assert.equal(isValidCpf("1234567890"), false);
  assert.equal(isValidCpf(""), false);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/rh-cpf.test.mjs`
Expected: FAIL — `Cannot find module .../src/lib/rh/cpf.js`

- [ ] **Step 3: Implementar**

Criar `src/lib/rh/cpf.js`:

```js
/**
 * CPF da ficha de funcionário: normalização e dígito verificador.
 * Puro (sem I/O) para poder ser testado direto com node --test.
 */

/** Só os dígitos. `null`/`undefined` viram string vazia. */
export function normalizeCpf(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/** Valida os dois dígitos verificadores. Sequências repetidas são inválidas. */
export function isValidCpf(value) {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // dígito(9) confere o 10º caractere; dígito(10) confere o 11º.
  const digito = (len) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(cpf[i]) * (len + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/rh-cpf.test.mjs`
Expected: PASS — 4 testes.

- [ ] **Step 5: Commitar**

```bash
git add src/lib/rh/cpf.js tests/rh-cpf.test.mjs
git commit -m "feat: validação de CPF para a ficha de funcionário"
```

---

### Task 2: Schema das tabelas

**Files:**
- Create: `db/funcionarios-schema.sql`
- Test: `tests/rh-schema.test.mjs`

**Interfaces:**
- Consumes: `set_updated_at()` de `db/schema.sql`; tabela `users` de `db/auth-schema.sql`.
- Produces: tabelas `funcionarios` e `funcionario_vinculos`; coluna `users.funcionario_id`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/rh-schema.test.mjs` (harness no padrão de `tests/fin-schema.test.mjs`):

```js
/**
 * Contrato do schema de funcionários contra Postgres real.
 *
 *   1. ficha e vínculos são criados e ligados;
 *   2. no máximo UM vínculo aberto por funcionário;
 *   3. saída não pode ser anterior à admissão;
 *   4. users.funcionario_id liga o login à ficha, um por ficha.
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
const TEST_DB = "vamaq_rh_test";

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
  for (const file of ["schema.sql", "auth-schema.sql", "funcionarios-schema.sql"]) {
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

async function novaFicha(nome, cpf = null) {
  const { rows } = await pool.query(
    `insert into funcionarios (nome, cpf) values ($1,$2) returning id`,
    [nome, cpf]
  );
  return rows[0].id;
}

test("ficha guarda vínculos e o cargo mora no vínculo", async () => {
  const id = await novaFicha("Ana Teste");
  await pool.query(
    `insert into funcionario_vinculos (funcionario_id, cargo, admissao, saida, motivo_saida)
     values ($1, 'Vendedora', '2023-01-10', '2024-05-31', 'Pedido de demissão')`,
    [id]
  );
  await pool.query(
    `insert into funcionario_vinculos (funcionario_id, cargo, admissao)
     values ($1, 'Gerente', '2026-02-01')`,
    [id]
  );
  const { rows } = await pool.query(
    `select cargo, saida from funcionario_vinculos
      where funcionario_id=$1 order by admissao`,
    [id]
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].cargo, "Vendedora");
  assert.equal(rows[1].cargo, "Gerente");
  assert.equal(rows[1].saida, null);
});

test("no máximo um vínculo aberto por funcionário", async () => {
  const id = await novaFicha("Bruno Teste");
  await pool.query(
    `insert into funcionario_vinculos (funcionario_id, cargo, admissao)
     values ($1, 'Lavador', '2026-01-05')`,
    [id]
  );
  await assert.rejects(
    () =>
      pool.query(
        `insert into funcionario_vinculos (funcionario_id, cargo, admissao)
         values ($1, 'Lavador', '2026-03-05')`,
        [id]
      ),
    /funcionario_vinculo_aberto_idx/
  );
});

test("saída não pode ser anterior à admissão", async () => {
  const id = await novaFicha("Carla Teste");
  await assert.rejects(
    () =>
      pool.query(
        `insert into funcionario_vinculos (funcionario_id, cargo, admissao, saida)
         values ($1, 'Secretária', '2026-04-01', '2026-03-01')`,
        [id]
      ),
    /vinculo_datas_check/
  );
});

test("CPF é único quando informado, e vários nulos convivem", async () => {
  await novaFicha("Sem CPF 1");
  await novaFicha("Sem CPF 2");
  await novaFicha("Com CPF", "52998224725");
  await assert.rejects(
    () => novaFicha("CPF repetido", "52998224725"),
    /funcionarios_cpf_key/
  );
});

test("um login por ficha; apagar a ficha não apaga o login", async () => {
  const id = await novaFicha("Diego Teste");
  await pool.query(
    `insert into users (name, email, password_hash, role, funcionario_id)
     values ('Diego Teste','diego@vamaqmotors.com.br','x','vendedor',$1)`,
    [id]
  );
  await assert.rejects(
    () =>
      pool.query(
        `insert into users (name, email, password_hash, role, funcionario_id)
         values ('Outro','outro@vamaqmotors.com.br','x','vendedor',$1)`,
        [id]
      ),
    /users_funcionario_idx/
  );

  await pool.query(`delete from funcionarios where id=$1`, [id]);
  const { rows } = await pool.query(
    `select funcionario_id from users where email='diego@vamaqmotors.com.br'`
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].funcionario_id, null);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/rh-schema.test.mjs`
Expected: FAIL — `ENOENT ... db/funcionarios-schema.sql`

- [ ] **Step 3: Implementar o schema**

Criar `db/funcionarios-schema.sql`:

```sql
-- ============================================================================
-- VAMAQ MOTORS — quadro de pessoal (ficha do funcionário e passagens).
--
-- `funcionarios` é a pessoa; `funcionario_vinculos` é cada passagem pela loja
-- (admissão → saída). O CARGO mora no vínculo: promoção e readmissão viram
-- histórico sem tabela extra. O acesso ao sistema é opcional dos dois lados —
-- há funcionário sem login (mecânico) e login sem ficha (contador).
--
-- Aplicar:  psql "$DATABASE_URL" -f db/funcionarios-schema.sql  (re-aplicável)
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists funcionarios (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  cpf           text unique,               -- só dígitos; único quando informado
  rg            text,
  nascimento    date,
  telefone      text,
  email_pessoal text,
  endereco      text,
  obs           text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists funcionario_vinculos (
  id             uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  cargo          text not null,
  admissao       date not null,
  saida          date,
  motivo_saida   text,
  obs            text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint vinculo_datas_check check (saida is null or saida >= admissao)
);

create index if not exists funcionario_vinculos_func_idx
  on funcionario_vinculos(funcionario_id);

-- Garantia no banco (não só na aplicação): um vínculo aberto por pessoa.
create unique index if not exists funcionario_vinculo_aberto_idx
  on funcionario_vinculos(funcionario_id) where saida is null;

-- Elo com o acesso. `set null` evita login órfão se a ficha for removida.
alter table users add column if not exists funcionario_id uuid
  references funcionarios(id) on delete set null;
create unique index if not exists users_funcionario_idx
  on users(funcionario_id) where funcionario_id is not null;

-- reusa set_updated_at() de db/schema.sql
drop trigger if exists funcionarios_set_updated_at on funcionarios;
create trigger funcionarios_set_updated_at
  before update on funcionarios
  for each row execute function set_updated_at();

drop trigger if exists funcionario_vinculos_set_updated_at on funcionario_vinculos;
create trigger funcionario_vinculos_set_updated_at
  before update on funcionario_vinculos
  for each row execute function set_updated_at();
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/rh-schema.test.mjs`
Expected: PASS — 5 testes.

- [ ] **Step 5: Conferir a idempotência**

Rode o teste **duas vezes seguidas** e confirme que passa nas duas. Depois, no banco de teste, aplique o arquivo duas vezes na mesma sessão:

Run: `node --test tests/rh-schema.test.mjs && node --test tests/rh-schema.test.mjs`
Expected: PASS nas duas execuções.

- [ ] **Step 6: Commitar**

```bash
git add db/funcionarios-schema.sql tests/rh-schema.test.mjs
git commit -m "feat: schema de funcionários com histórico de vínculos"
```

---

### Task 3: Desligamento atômico (SQL)

Fecha o vínculo aberto **e** desativa o login vinculado numa única instrução — sem janela em que a pessoa está desligada com acesso válido.

**Files:**
- Create: `src/lib/rh/sql.js`
- Modify: `tests/rh-schema.test.mjs` (acrescentar testes ao final)

**Interfaces:**
- Consumes: schema da Task 2.
- Produces: `DESLIGAR_SQL` — recebe `$1 funcionario_id`, `$2 saida`, `$3 motivo`; devolve uma linha `{ vinculo_id, user_id }`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao final de `tests/rh-schema.test.mjs` (e ao import do topo, `import { DESLIGAR_SQL } from "../src/lib/rh/sql.js";`):

```js
test("desligar fecha o vínculo e desativa o login na mesma instrução", async () => {
  const id = await novaFicha("Elis Teste");
  await pool.query(
    `insert into funcionario_vinculos (funcionario_id, cargo, admissao)
     values ($1, 'Vendedora', '2026-01-02')`,
    [id]
  );
  await pool.query(
    `insert into users (name, email, password_hash, role, funcionario_id, active)
     values ('Elis Teste','elis@vamaqmotors.com.br','x','vendedor',$1,true)`,
    [id]
  );

  const { rows } = await pool.query(DESLIGAR_SQL, [id, "2026-06-30", "Fim de contrato"]);
  assert.ok(rows[0].vinculo_id, "devolve o vínculo fechado");
  assert.ok(rows[0].user_id, "devolve o login desativado");

  const v = await pool.query(
    `select saida, motivo_saida from funcionario_vinculos where funcionario_id=$1`,
    [id]
  );
  assert.equal(v.rows[0].motivo_saida, "Fim de contrato");
  assert.ok(v.rows[0].saida, "gravou a data de saída");

  const u = await pool.query(`select active from users where funcionario_id=$1`, [id]);
  assert.equal(u.rows[0].active, false);
});

test("desligar sem vínculo aberto devolve vinculo_id nulo", async () => {
  const id = await novaFicha("Fabio Teste");
  const { rows } = await pool.query(DESLIGAR_SQL, [id, "2026-06-30", null]);
  assert.equal(rows[0].vinculo_id, null);
});

test("desligar funcionário sem login devolve user_id nulo", async () => {
  const id = await novaFicha("Gil Teste");
  await pool.query(
    `insert into funcionario_vinculos (funcionario_id, cargo, admissao)
     values ($1, 'Mecânico', '2026-01-02')`,
    [id]
  );
  const { rows } = await pool.query(DESLIGAR_SQL, [id, "2026-07-01", null]);
  assert.ok(rows[0].vinculo_id);
  assert.equal(rows[0].user_id, null);
});

test("desligar com data anterior à admissão é rejeitado pelo CHECK", async () => {
  const id = await novaFicha("Hugo Teste");
  await pool.query(
    `insert into funcionario_vinculos (funcionario_id, cargo, admissao)
     values ($1, 'Lavador', '2026-05-01')`,
    [id]
  );
  await assert.rejects(
    () => pool.query(DESLIGAR_SQL, [id, "2026-04-01", null]),
    /vinculo_datas_check/
  );
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/rh-schema.test.mjs`
Expected: FAIL — `Cannot find module .../src/lib/rh/sql.js`

- [ ] **Step 3: Implementar**

Criar `src/lib/rh/sql.js`:

```js
/**
 * SQL do desligamento. Fica num módulo PURO (só strings) por dois motivos:
 * o teste consegue rodá-lo contra o Postgres sem passar pelo alias "@/", e a
 * instrução exercitada no teste é literalmente a que a aplicação executa.
 *
 * Fechar o vínculo e cortar o acesso acontecem na MESMA instrução: não existe
 * instante em que a pessoa está desligada e o login continua valendo.
 *
 * Parâmetros: $1 funcionario_id · $2 saida (date) · $3 motivo (text|null)
 * Retorno: uma linha { vinculo_id, user_id } — `vinculo_id` nulo significa que
 * não havia vínculo aberto; `user_id` nulo apenas indica ficha sem login.
 */
export const DESLIGAR_SQL = `
  with fechado as (
    update funcionario_vinculos
       set saida = $2, motivo_saida = $3
     where funcionario_id = $1 and saida is null
    returning id, funcionario_id
  ), acesso as (
    update users set active = false
     where funcionario_id in (select funcionario_id from fechado)
    returning id
  )
  select (select id from fechado) as vinculo_id,
         (select id from acesso)  as user_id
`;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/rh-schema.test.mjs`
Expected: PASS — 9 testes.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS — os testes que já existiam continuam verdes.

- [ ] **Step 6: Commitar**

```bash
git add src/lib/rh/sql.js tests/rh-schema.test.mjs
git commit -m "feat: desligamento fecha vínculo e corta acesso atomicamente"
```

---

### Task 4: Camada de dados

**Files:**
- Create: `src/lib/rh/funcionarios.js`
- Modify: `src/lib/auth/users.js`

**Interfaces:**
- Consumes: `normalizeCpf`/`isValidCpf` (Task 1), `DESLIGAR_SQL` (Task 3), `query` de `@/lib/db`.
- Produces:
  - `listFuncionarios() -> Array<{id, nome, cpf, telefone, cargo, admissao, saida, ativo, user_id, user_email, user_active}>`
  - `getFuncionario(id) -> {…ficha, vinculos: [], usuario: {id,name,email,role,active}|null} | null`
  - `createFuncionario(data) -> {funcionario} | {error}`
  - `updateFuncionario(id, data) -> {funcionario} | {error}`
  - `admitir(id, {cargo, admissao, obs}) -> {vinculo} | {error}`
  - `desligar(id, {saida, motivo}) -> {ok, vinculo_id, user_id} | {error}`
  - de `users.js`: `setUserFuncionario(userId, funcionarioId) -> {id, funcionario_id} | null`; `createUser({name, email, role, funcionario_id})`; `listUsers()` passa a devolver também `funcionario_id`.

- [ ] **Step 1: Criar a camada**

Criar `src/lib/rh/funcionarios.js`:

```js
/**
 * Quadro de pessoal: ficha do funcionário e suas passagens pela loja.
 * Server-only (usa pg). Só admin chega aqui — ver src/app/admin/funcionarios.
 */
import { query } from "@/lib/db";
import { normalizeCpf, isValidCpf } from "@/lib/rh/cpf";
import { DESLIGAR_SQL } from "@/lib/rh/sql";

/** Lista com o vínculo mais recente e o login, se houver. */
export async function listFuncionarios() {
  const { rows } = await query(
    `select f.id, f.nome, f.cpf, f.telefone,
            v.cargo, v.admissao, v.saida,
            u.id as user_id, u.email as user_email, u.active as user_active
       from funcionarios f
       left join lateral (
         select cargo, admissao, saida
           from funcionario_vinculos
          where funcionario_id = f.id
          order by admissao desc, created_at desc
          limit 1
       ) v on true
       left join users u on u.funcionario_id = f.id
      order by f.nome`
  );
  return rows.map((r) => ({ ...r, ativo: Boolean(r.admissao) && !r.saida }));
}

/** Ficha completa: dados, todas as passagens e o login vinculado. */
export async function getFuncionario(id) {
  const f = await query(`select * from funcionarios where id = $1`, [id]);
  if (!f.rows.length) return null;
  const v = await query(
    `select * from funcionario_vinculos
      where funcionario_id = $1 order by admissao desc, created_at desc`,
    [id]
  );
  const u = await query(
    `select id, name, email, role, active, must_change_password
       from users where funcionario_id = $1`,
    [id]
  );
  const vinculos = v.rows;
  return {
    ...f.rows[0],
    vinculos,
    vinculoAberto: vinculos.find((x) => !x.saida) || null,
    usuario: u.rows[0] || null,
  };
}

const CAMPOS = ["nome", "cpf", "rg", "nascimento", "telefone", "email_pessoal", "endereco", "obs"];

/** Valida e normaliza o que veio do formulário. Retorna {values} ou {error}. */
async function prepararFicha(data, { ignorarId = null } = {}) {
  const nome = String(data.nome || "").trim();
  if (!nome) return { error: "Nome é obrigatório." };

  const cpf = normalizeCpf(data.cpf);
  if (cpf && !isValidCpf(cpf)) return { error: "CPF inválido." };
  if (cpf) {
    const dup = await query(
      `select 1 from funcionarios where cpf = $1 and ($2::uuid is null or id <> $2)`,
      [cpf, ignorarId]
    );
    if (dup.rows.length) return { error: "Já existe um funcionário com esse CPF." };
  }

  return {
    values: {
      nome,
      cpf: cpf || null,
      rg: data.rg?.trim() || null,
      nascimento: data.nascimento || null,
      telefone: data.telefone?.trim() || null,
      email_pessoal: data.email_pessoal?.trim().toLowerCase() || null,
      endereco: data.endereco?.trim() || null,
      obs: data.obs?.trim() || null,
    },
  };
}

export async function createFuncionario(data) {
  const p = await prepararFicha(data);
  if (p.error) return { error: p.error };
  const v = p.values;
  const { rows } = await query(
    `insert into funcionarios (${CAMPOS.join(", ")})
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    CAMPOS.map((c) => v[c])
  );
  return { funcionario: rows[0] };
}

export async function updateFuncionario(id, data) {
  const p = await prepararFicha(data, { ignorarId: id });
  if (p.error) return { error: p.error };
  const v = p.values;
  const { rows } = await query(
    `update funcionarios set ${CAMPOS.map((c, i) => `${c} = $${i + 2}`).join(", ")}
      where id = $1 returning *`,
    [id, ...CAMPOS.map((c) => v[c])]
  );
  if (!rows.length) return { error: "Funcionário não encontrado." };
  return { funcionario: rows[0] };
}

/** Admite ou readmite: abre um vínculo novo. */
export async function admitir(id, { cargo, admissao, obs }) {
  cargo = String(cargo || "").trim();
  if (!cargo) return { error: "Informe o cargo." };
  if (!admissao) return { error: "Informe a data de admissão." };

  const aberto = await query(
    `select 1 from funcionario_vinculos where funcionario_id = $1 and saida is null`,
    [id]
  );
  if (aberto.rows.length) return { error: "Este funcionário já tem um vínculo em aberto." };

  const { rows } = await query(
    `insert into funcionario_vinculos (funcionario_id, cargo, admissao, obs)
     values ($1,$2,$3,$4) returning *`,
    [id, cargo, admissao, obs?.trim() || null]
  );
  return { vinculo: rows[0] };
}

/** Desliga: fecha o vínculo e desativa o login, na mesma instrução. */
export async function desligar(id, { saida, motivo }) {
  if (!saida) return { error: "Informe a data de saída." };
  let rows;
  try {
    ({ rows } = await query(DESLIGAR_SQL, [id, saida, motivo?.trim() || null]));
  } catch (err) {
    if (err?.constraint === "vinculo_datas_check") {
      return { error: "A data de saída não pode ser anterior à admissão." };
    }
    throw err;
  }
  const row = rows[0] || {};
  if (!row.vinculo_id) return { error: "Este funcionário não tem vínculo em aberto." };
  return { ok: true, vinculo_id: row.vinculo_id, user_id: row.user_id || null };
}
```

- [ ] **Step 2: Ligar o login à ficha em `users.js`**

Em `src/lib/auth/users.js`:

1. `listUsers` passa a trazer a ficha ligada (o nome vem da lista de fichas, na tela) — substituir a query por:

```js
export async function listUsers() {
  const { rows } = await query(
    `select u.id, u.name, u.email, u.role, u.active, u.must_change_password,
            u.approval_limit, u.created_at, u.funcionario_id
       from users u
      order by u.created_at asc`
  );
  return rows;
}
```

2. `createUser` aceita a ficha — trocar a assinatura e o insert:

```js
export async function createUser({ name, email, role, funcionario_id = null }) {
```

```js
  const { rows } = await query(
    `insert into users (name, email, password_hash, role, active, must_change_password, funcionario_id)
       values ($1, $2, $3, $4, true, true, $5)
     returning id, name, email, role, active, funcionario_id`,
    [name, email, password_hash, role, funcionario_id || null]
  );
```

3. Acrescentar ao final do arquivo:

```js
/** Liga (ou desliga) o login de uma ficha de funcionário. */
export async function setUserFuncionario(userId, funcionarioId) {
  const { rows } = await query(
    `update users set funcionario_id = $2 where id = $1
     returning id, funcionario_id`,
    [userId, funcionarioId || null]
  );
  return rows.length ? rows[0] : null;
}
```

- [ ] **Step 3: Verificar que nada quebrou**

Run: `npm test && npm run build`
Expected: testes PASS e build sem erro. (A camada em si é exercitada pelos testes de SQL das Tasks 2 e 3; o build prova que os imports e o alias `@/` resolvem.)

- [ ] **Step 4: Commitar**

```bash
git add src/lib/rh/funcionarios.js src/lib/auth/users.js
git commit -m "feat: camada de dados do quadro de pessoal"
```

---

### Task 5: Tela de lista `/admin/funcionarios`

**Files:**
- Modify: `src/lib/auth/permissions.js`
- Create: `src/app/admin/funcionarios/page.js`
- Create: `src/app/admin/funcionarios/actions.js`
- Create: `src/app/admin/funcionarios/FuncionariosClient.js`

**Interfaces:**
- Consumes: `listFuncionarios`, `createFuncionario` (Task 4); `requireRole` de `@/lib/auth/dal`.
- Produces: Server Actions `createFuncionarioAction(formData)` e `updateFuncionarioAction(id, formData)`; rota `/admin/funcionarios`.

- [ ] **Step 1: Registrar a seção no menu**

Em `src/lib/auth/permissions.js`, acrescentar ao array `SECTIONS`, **logo antes** da entrada `usuarios` (a ordem vai do mais específico ao mais genérico, e `/admin/funcionarios` não conflita com as demais):

```js
  { key: "funcionarios", prefix: "/admin/funcionarios", label: "Funcionários", icon: "🧑‍🔧", roles: [] },
```

E incluir a chave na ordem do menu em `navFor()`:

```js
  const order = ["dashboard", "estoque", "crm", "financeiro", "documentos", "criativos", "fipe", "tutoriais", "funcionarios", "usuarios"];
```

`roles: []` = só admin, igual a Usuários.

- [ ] **Step 2: Criar as Server Actions**

Criar `src/app/admin/funcionarios/actions.js`:

```js
"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import {
  createFuncionario,
  updateFuncionario,
  admitir,
  desligar,
} from "@/lib/rh/funcionarios";

/** Campos da ficha lidos do formulário. */
function fichaFrom(formData) {
  return {
    nome: formData.get("nome"),
    cpf: formData.get("cpf"),
    rg: formData.get("rg"),
    nascimento: formData.get("nascimento") || null,
    telefone: formData.get("telefone"),
    email_pessoal: formData.get("email_pessoal"),
    endereco: formData.get("endereco"),
    obs: formData.get("obs"),
  };
}

export async function createFuncionarioAction(formData) {
  await requireRole("admin");
  const res = await createFuncionario(fichaFrom(formData));
  if (res.error) return { error: res.error };
  revalidatePath("/admin/funcionarios");
  return { ok: true, id: res.funcionario.id };
}

export async function updateFuncionarioAction(id, formData) {
  await requireRole("admin");
  const res = await updateFuncionario(id, fichaFrom(formData));
  if (res.error) return { error: res.error };
  revalidatePath("/admin/funcionarios");
  revalidatePath(`/admin/funcionarios/${id}`);
  return { ok: true };
}

export async function admitirAction(id, { cargo, admissao, obs }) {
  await requireRole("admin");
  const res = await admitir(id, { cargo, admissao, obs });
  if (res.error) return { error: res.error };
  revalidatePath("/admin/funcionarios");
  revalidatePath(`/admin/funcionarios/${id}`);
  return { ok: true };
}

export async function desligarAction(id, { saida, motivo }) {
  await requireRole("admin");
  const res = await desligar(id, { saida, motivo });
  if (res.error) return { error: res.error };
  revalidatePath("/admin/funcionarios");
  revalidatePath(`/admin/funcionarios/${id}`);
  revalidatePath("/admin/usuarios");
  // acessoCortado avisa a tela de que o login foi desativado junto.
  return { ok: true, acessoCortado: Boolean(res.user_id) };
}
```

- [ ] **Step 3: Criar a página (Server Component)**

Criar `src/app/admin/funcionarios/page.js`:

```js
import { requireRole } from "@/lib/auth/dal";
import { listFuncionarios } from "@/lib/rh/funcionarios";
import FuncionariosClient from "./FuncionariosClient";

export const metadata = {
  title: "Funcionários — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function FuncionariosPage() {
  // Só admin (o layout já barra; aqui é defesa em profundidade).
  await requireRole("admin");
  const funcionarios = await listFuncionarios();
  return <FuncionariosClient funcionarios={funcionarios} />;
}
```

- [ ] **Step 4: Criar o client da lista**

Criar `src/app/admin/funcionarios/FuncionariosClient.js`. Espelhe a estrutura de `src/app/admin/usuarios/UsuariosClient.js` (mesmos `styles.card`, `styles.formGrid`, `styles.table`, `styles.tableWrap`, `useTransition`):

```js
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import styles from "../admin.module.css";
import { createFuncionarioAction } from "./actions";

const fmtData = (d) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";

export default function FuncionariosClient({ funcionarios }) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState(null);
  const [aberto, setAberto] = useState(false);

  function handleCreate(e) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;
    startTransition(async () => {
      const r = await createFuncionarioAction(fd);
      if (r?.error) setErr(r.error);
      else {
        form.reset();
        setAberto(false);
      }
    });
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 600 }}>Funcionários</h2>
        <button onClick={() => setAberto((v) => !v)} className={styles.btnPrimary}>
          {aberto ? "Cancelar" : "+ Nova ficha"}
        </button>
      </div>

      {aberto && (
        <div className={styles.card} style={{ marginBottom: 24 }}>
          <form onSubmit={handleCreate} className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nome *</label>
              <input name="nome" className={styles.formInput} required />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>CPF</label>
              <input name="cpf" className={styles.formInput} placeholder="000.000.000-00" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Telefone</label>
              <input name="telefone" className={styles.formInput} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nascimento</label>
              <input name="nascimento" type="date" className={styles.formInput} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>RG</label>
              <input name="rg" className={styles.formInput} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>E-mail pessoal</label>
              <input name="email_pessoal" type="email" className={styles.formInput} />
            </div>
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>Endereço</label>
              <input name="endereco" className={styles.formInput} />
            </div>
            <div className={styles.formGroupFull}>
              <label className={styles.formLabel}>Observações</label>
              <textarea name="obs" rows={2} className={styles.formTextarea} />
            </div>
            <div className={styles.formActions}>
              <button type="submit" className={styles.btnPrimary} disabled={isPending}>
                {isPending ? "Salvando…" : "Salvar ficha"}
              </button>
            </div>
          </form>
          {err && <p style={{ color: "#b91c1c", fontSize: "0.85rem", marginBottom: 0 }}>{err}</p>}
          <p style={{ fontSize: "0.8rem", color: "#666", marginBottom: 0 }}>
            A admissão (cargo e data) é registrada na ficha, depois de salvar.
          </p>
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Cargo atual</th>
                <th>Admissão</th>
                <th>Situação</th>
                <th>Acesso ao sistema</th>
              </tr>
            </thead>
            <tbody>
              {funcionarios.map((f) => (
                <tr key={f.id} style={{ opacity: f.ativo ? 1 : 0.6 }}>
                  <td>
                    <Link href={`/admin/funcionarios/${f.id}`}><strong>{f.nome}</strong></Link>
                  </td>
                  <td>{f.cargo || "—"}</td>
                  <td>{fmtData(f.admissao)}</td>
                  <td>
                    {f.ativo ? (
                      <span className={styles.badgeSuccess}>Ativo</span>
                    ) : f.admissao ? (
                      <span className={styles.badgeWarning} style={{ background: "#f3f4f6", color: "#6b7280" }}>
                        Desligado em {fmtData(f.saida)}
                      </span>
                    ) : (
                      <span className={styles.badgeWarning} style={{ background: "#fef9c3", color: "#a16207" }}>
                        Sem admissão
                      </span>
                    )}
                  </td>
                  <td>
                    {f.user_email ? (
                      <>
                        {f.user_email}
                        {!f.user_active && <span style={{ color: "#6b7280" }}> (inativo)</span>}
                      </>
                    ) : (
                      <span style={{ color: "#9ca3af" }}>sem acesso</span>
                    )}
                  </td>
                </tr>
              ))}
              {funcionarios.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#6b7280", padding: 24 }}>
                    Nenhuma ficha cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 5: Verificar**

Run: `npm run build`
Expected: build sem erro.

Depois, com `npm run dev` e logado como admin: `/admin/funcionarios` aparece no menu, a criação de ficha funciona, e um CPF inválido devolve "CPF inválido." sem quebrar a tela. Conferir também que um usuário `vendedor` **não** vê o item no menu e é redirecionado ao abrir a URL direto.

- [ ] **Step 6: Commitar**

```bash
git add src/lib/auth/permissions.js src/app/admin/funcionarios
git commit -m "feat: tela de funcionários com cadastro de ficha"
```

---

### Task 6: Ficha do funcionário `/admin/funcionarios/[id]`

**Files:**
- Create: `src/app/admin/funcionarios/[id]/page.js`
- Create: `src/app/admin/funcionarios/[id]/FichaClient.js`
- Modify: `src/app/admin/funcionarios/actions.js` (acrescentar `criarAcessoAction`)

**Interfaces:**
- Consumes: `getFuncionario` (Task 4); `admitirAction`, `desligarAction`, `updateFuncionarioAction` (Task 5); `createUser` de `@/lib/auth/users`.
- Produces: `criarAcessoAction(funcionarioId, {login, role}) -> {ok, accessText} | {error}`.

- [ ] **Step 1: Acrescentar a action de criar acesso**

Em `src/app/admin/funcionarios/actions.js`, acrescentar os imports e a action. O texto de instruções é o mesmo de `src/app/admin/usuarios/actions.js` — mantenha as duas versões iguais:

```js
import { createUser } from "@/lib/auth/users";

const LOGIN_URL = "https://vamaqmotors.com.br/login";

function buildAccessText({ name, email, tempPassword }) {
  return [
    `Olá, ${name}! Seu acesso ao Painel Vamaq Motors:`,
    ``,
    `Link: ${LOGIN_URL}`,
    `Usuário: ${email}`,
    `Senha temporária: ${tempPassword}`,
    ``,
    `No primeiro acesso o sistema vai pedir para você criar uma senha nova.`,
  ].join("\n");
}

/** Cria o login já vinculado à ficha. Devolve a senha em claro UMA vez. */
export async function criarAcessoAction(funcionarioId, { nome, login, role }) {
  await requireRole("admin");
  const l = String(login || "").trim().toLowerCase();
  const email = l.includes("@") ? l : `${l}@vamaqmotors.com.br`;

  const res = await createUser({ name: nome, email, role, funcionario_id: funcionarioId });
  if (res.error) return { error: res.error };

  revalidatePath(`/admin/funcionarios/${funcionarioId}`);
  revalidatePath("/admin/usuarios");
  return {
    ok: true,
    email: res.user.email,
    accessText: buildAccessText({ name: nome, email: res.user.email, tempPassword: res.tempPassword }),
  };
}
```

- [ ] **Step 2: Criar a página da ficha**

Criar `src/app/admin/funcionarios/[id]/page.js`. **Atenção:** neste Next, `params` é assíncrono — confira `node_modules/next/dist/docs/` se tiver dúvida.

```js
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { getFuncionario } from "@/lib/rh/funcionarios";
import { ROLES } from "@/lib/auth/permissions";
import FichaClient from "./FichaClient";

export const metadata = {
  title: "Ficha do funcionário — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function FichaPage({ params }) {
  await requireRole("admin");
  const { id } = await params;
  const funcionario = await getFuncionario(id);
  if (!funcionario) notFound();
  return <FichaClient funcionario={funcionario} roles={ROLES} />;
}
```

- [ ] **Step 3: Criar o client da ficha**

Criar `src/app/admin/funcionarios/[id]/FichaClient.js`, com quatro blocos: dados pessoais (formulário de edição), passagens (tabela), ação de desligar/readmitir, e acesso ao sistema.

```js
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import styles from "../../admin.module.css";
import {
  updateFuncionarioAction,
  admitirAction,
  desligarAction,
  criarAcessoAction,
} from "../actions";

const fmtData = (d) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";
const paraInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export default function FichaClient({ funcionario: f, roles }) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState(null);
  const [acesso, setAcesso] = useState(null); // { email, accessText }
  const [copiado, setCopiado] = useState(false);
  const aberto = f.vinculoAberto;

  function run(fn) {
    setErr(null);
    startTransition(async () => {
      const r = await fn();
      if (r?.error) setErr(r.error);
      else if (r?.accessText) { setAcesso(r); setCopiado(false); }
    });
  }

  function salvarDados(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(() => updateFuncionarioAction(f.id, fd));
  }

  function admitirSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(() => admitirAction(f.id, {
      cargo: fd.get("cargo"),
      admissao: fd.get("admissao"),
      obs: fd.get("obs"),
    }));
  }

  function desligarSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!confirm(`Desligar ${f.nome}? O acesso ao sistema, se houver, é desativado junto.`)) return;
    run(() => desligarAction(f.id, { saida: fd.get("saida"), motivo: fd.get("motivo") }));
  }

  function criarAcessoSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(() => criarAcessoAction(f.id, {
      nome: f.nome,
      login: fd.get("login"),
      role: fd.get("role"),
    }));
  }

  return (
    <>
      <Link href="/admin/funcionarios" className={styles.backLink}>← Funcionários</Link>
      <h2 style={{ fontSize: "1.3rem", fontWeight: 600, margin: "12px 0 20px" }}>
        {f.nome}{" "}
        {aberto
          ? <span className={styles.badgeSuccess}>{aberto.cargo}</span>
          : <span className={styles.badgeWarning} style={{ background: "#f3f4f6", color: "#6b7280" }}>Desligado</span>}
      </h2>

      {err && (
        <div className={styles.card} style={{ marginBottom: 16, borderLeft: "4px solid #b91c1c" }}>
          <p style={{ color: "#b91c1c", margin: 0 }}>{err}</p>
        </div>
      )}

      {/* Dados pessoais */}
      <div className={styles.card} style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Dados pessoais</h3>
        <form onSubmit={salvarDados} className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Nome *</label>
            <input name="nome" defaultValue={f.nome} className={styles.formInput} required />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>CPF</label>
            <input name="cpf" defaultValue={f.cpf || ""} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>RG</label>
            <input name="rg" defaultValue={f.rg || ""} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Nascimento</label>
            <input name="nascimento" type="date" defaultValue={paraInput(f.nascimento)} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Telefone</label>
            <input name="telefone" defaultValue={f.telefone || ""} className={styles.formInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>E-mail pessoal</label>
            <input name="email_pessoal" type="email" defaultValue={f.email_pessoal || ""} className={styles.formInput} />
          </div>
          <div className={styles.formGroupFull}>
            <label className={styles.formLabel}>Endereço</label>
            <input name="endereco" defaultValue={f.endereco || ""} className={styles.formInput} />
          </div>
          <div className={styles.formGroupFull}>
            <label className={styles.formLabel}>Observações</label>
            <textarea name="obs" rows={2} defaultValue={f.obs || ""} className={styles.formTextarea} />
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.btnPrimary} disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar dados"}
            </button>
          </div>
        </form>
      </div>

      {/* Passagens pela loja */}
      <div className={styles.card} style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Passagens pela loja</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Cargo</th><th>Admissão</th><th>Saída</th><th>Motivo</th></tr>
            </thead>
            <tbody>
              {f.vinculos.map((v) => (
                <tr key={v.id}>
                  <td><strong>{v.cargo}</strong></td>
                  <td>{fmtData(v.admissao)}</td>
                  <td>{v.saida ? fmtData(v.saida) : <span className={styles.badgeSuccess}>Em curso</span>}</td>
                  <td>{v.motivo_saida || "—"}</td>
                </tr>
              ))}
              {f.vinculos.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "#6b7280", padding: 16 }}>
                    Nenhuma admissão registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {aberto ? (
          <form onSubmit={desligarSubmit} className={styles.formGrid} style={{ marginTop: 16 }}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Data de saída *</label>
              <input name="saida" type="date" className={styles.formInput} required />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Motivo</label>
              <input name="motivo" className={styles.formInput} placeholder="Pedido de demissão, fim de contrato…" />
            </div>
            <div className={styles.formActions}>
              <button type="submit" className={styles.btnDanger} disabled={isPending}>Desligar</button>
            </div>
          </form>
        ) : (
          <form onSubmit={admitirSubmit} className={styles.formGrid} style={{ marginTop: 16 }}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Cargo *</label>
              <input name="cargo" className={styles.formInput} placeholder="Vendedor, mecânico…" required />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Data de admissão *</label>
              <input name="admissao" type="date" className={styles.formInput} required />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Observações</label>
              <input name="obs" className={styles.formInput} />
            </div>
            <div className={styles.formActions}>
              <button type="submit" className={styles.btnPrimary} disabled={isPending}>
                {f.vinculos.length ? "Readmitir" : "Registrar admissão"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Acesso ao sistema */}
      <div className={styles.card}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Acesso ao sistema</h3>

        {acesso && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: "0.85rem", color: "#666", marginTop: 0 }}>
              Copie e envie para a pessoa. A senha só aparece aqui, agora.
            </p>
            <textarea readOnly value={acesso.accessText} rows={7} className={styles.formTextarea}
              style={{ fontFamily: "monospace", fontSize: "0.85rem" }} />
            <button
              className={styles.btnPrimary}
              style={{ marginTop: 8 }}
              onClick={() => {
                navigator.clipboard.writeText(acesso.accessText);
                setCopiado(true);
              }}
            >
              {copiado ? "✓ Copiado!" : "Copiar instruções"}
            </button>
          </div>
        )}

        {f.usuario ? (
          <p style={{ margin: 0 }}>
            <strong>{f.usuario.email}</strong> — {roles[f.usuario.role] || f.usuario.role}
            {!f.usuario.active && <span style={{ color: "#b91c1c" }}> · acesso desativado</span>}
            {" · "}
            <Link href="/admin/usuarios">gerenciar em Usuários</Link>
            {!f.usuario.active && aberto && (
              <span style={{ display: "block", fontSize: "0.85rem", color: "#a16207", marginTop: 8 }}>
                A pessoa foi readmitida, mas o acesso segue desativado. Reative e redefina a senha em Usuários.
              </span>
            )}
          </p>
        ) : !acesso ? (
          <form onSubmit={criarAcessoSubmit} className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Login</label>
              <input name="login" className={styles.formInput} placeholder="victor  →  victor@vamaqmotors.com.br" required />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Papel</label>
              <select name="role" className={styles.formSelect} defaultValue="vendedor">
                {Object.entries(roles).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>
            <div className={styles.formActions}>
              <button type="submit" className={styles.btnPrimary} disabled={isPending}>Criar acesso</button>
            </div>
          </form>
        ) : null}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Verificar**

Run: `npm run build`
Expected: build sem erro.

Com `npm run dev`, percorra o ciclo completo numa ficha de teste: registrar admissão → criar acesso (copiar o texto) → **desligar** → conferir em `/admin/usuarios` que o login ficou **Inativo** → **readmitir** → conferir que aparece o aviso de reativar o acesso e que a tabela mostra as duas passagens.

- [ ] **Step 5: Commitar**

```bash
git add src/app/admin/funcionarios
git commit -m "feat: ficha do funcionário com passagens, desligamento e acesso"
```

---

### Task 7: Vincular ficha em `/admin/usuarios`

**Files:**
- Modify: `src/app/admin/usuarios/page.js`
- Modify: `src/app/admin/usuarios/actions.js`
- Modify: `src/app/admin/usuarios/UsuariosClient.js:166-260`

**Interfaces:**
- Consumes: `listFuncionarios` (Task 4), `setUserFuncionario` (Task 4).
- Produces: `vincularFuncionarioAction(userId, funcionarioId) -> {ok} | {error}`.

- [ ] **Step 1: Passar as fichas para a tela**

Em `src/app/admin/usuarios/page.js`:

```js
import { listFuncionarios } from "@/lib/rh/funcionarios";
```

```js
  const users = await listUsers();
  const funcionarios = await listFuncionarios();
  return <UsuariosClient users={users} roles={ROLES} meId={me.id} funcionarios={funcionarios} />;
```

- [ ] **Step 2: Criar a action de vínculo**

Em `src/app/admin/usuarios/actions.js`, acrescentar `setUserFuncionario` ao import de `@/lib/auth/users` e a action. Uma ficha já ligada a outro login faz o índice único `users_funcionario_idx` estourar — por isso o `try/catch`:

```js
export async function vincularFuncionarioAction(userId, funcionarioId) {
  await requireRole("admin");
  try {
    await setUserFuncionario(userId, funcionarioId || null);
  } catch (err) {
    if (err?.constraint === "users_funcionario_idx") {
      return { error: "Essa ficha já está ligada a outro login." };
    }
    throw err;
  }
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/funcionarios");
  return { ok: true };
}
```

- [ ] **Step 3: Acrescentar a coluna na tabela**

Em `src/app/admin/usuarios/UsuariosClient.js`:

1. Assinatura e import:

```js
import { vincularFuncionarioAction } from "./actions";
```

```js
export default function UsuariosClient({ users, roles, meId, funcionarios }) {
```

2. Handler, junto dos outros:

```js
  function handleFuncionario(u, funcionarioId) {
    setErr(null);
    startTransition(async () => {
      const r = await vincularFuncionarioAction(u.id, funcionarioId || null);
      if (r?.error) setErr(r.error);
    });
  }
```

3. Novo `<th>Funcionário</th>` depois de `<th>Login</th>`, e a célula correspondente depois da célula do e-mail:

```jsx
                  <td>
                    <select
                      value={u.funcionario_id || ""}
                      onChange={(e) => handleFuncionario(u, e.target.value)}
                      disabled={isPending}
                      className={styles.formSelect}
                      style={{ padding: "4px 8px", fontSize: "0.82rem" }}
                      title="Ficha de funcionário ligada a este login"
                    >
                      <option value="">— sem ficha —</option>
                      {funcionarios.map((f) => (
                        <option key={f.id} value={f.id}>{f.nome}</option>
                      ))}
                    </select>
                  </td>
```

- [ ] **Step 4: Verificar**

Run: `npm test && npm run build`
Expected: testes PASS, build sem erro.

Com `npm run dev`: em `/admin/usuarios`, ligar o login do Victor à ficha dele e conferir que a ficha em `/admin/funcionarios` passa a mostrar o e-mail em "Acesso ao sistema". Tentar ligar a mesma ficha a um segundo login deve exibir "Essa ficha já está ligada a outro login." sem quebrar a tela.

- [ ] **Step 5: Commitar**

```bash
git add src/app/admin/usuarios
git commit -m "feat: vincular login à ficha de funcionário na tela de usuários"
```

---

### Task 8: Deploy

**Files:**
- Nenhum arquivo novo. Só a subida para a VPS.

- [ ] **Step 1: Subir o código**

```bash
git push origin main
```

Se o push por SSH falhar, use `gh auth setup-git` e push por HTTPS (ver `MEMORY.md`).

- [ ] **Step 2: Aplicar o schema antes do build**

```bash
ssh -i ~/.ssh/vamaq_vps root@185.197.194.18
cd /var/www/vamaq && git pull origin main
psql "$DATABASE_URL" -f db/funcionarios-schema.sql
```

Expected: sem erro; o arquivo é re-aplicável.

- [ ] **Step 3: Build e restart**

```bash
npm install && npm run build && pm2 restart vamaq
pm2 logs vamaq --lines 20 --nostream
```

Expected: app de pé, sem erro novo no log. Atenção: `/var/vamaq` é um clone abandonado — o app roda em `/var/www/vamaq`.

- [ ] **Step 4: Conferir em produção**

Logado como admin em `https://vamaqmotors.com.br/admin/funcionarios`: criar as fichas de Mateus, Louanny e Victor, registrar a admissão de cada um e ligar cada ficha ao login em `/admin/usuarios`.

- [ ] **Step 5: Registrar na documentação**

Acrescentar uma linha ao `docs/README.md` apontando a spec e o novo schema, e commitar:

```bash
git add docs/README.md && git commit -m "docs: registra o módulo de funcionários" && git push origin main
```

---

## Notas de revisão

- **Cobertura da spec:** schema (Task 2), desligamento atômico (Task 3), CPF (Task 1), camada e regras (Task 4), permissão só-admin (Task 5), telas de lista e ficha (Tasks 5 e 6), integração com Usuários (Task 7), migração das três pessoas e deploy (Task 8).
- **Sem teste automatizado de UI:** o projeto não tem harness de componente React, e montar um está fora do escopo desta entrega. As Tasks 5–7 são verificadas por `npm run build` mais o roteiro manual descrito em cada uma. O que é crítico e silencioso — o desligamento cortar o acesso — está coberto por teste de banco na Task 3.
- **Fora de escopo, por decisão:** RENAVE (retomar perto de 30/09/2026), documentos anexados à ficha, ponto, férias e salário.
