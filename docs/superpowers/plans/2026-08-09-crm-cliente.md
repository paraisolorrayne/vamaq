# CRM ligado ao cadastro de clientes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A oportunidade do CRM passa a apontar para um cliente cadastrado, e vender pelo CRM passa a registrar o carro na ficha dele.

**Architecture:** `oportunidades.cliente_id` opcional, com `cliente_nome` continuando a existir como rótulo. O vendedor ganha **criar** cliente (não editar, não a tela). A venda pelo CRM cria o vínculo `cliente_veiculos` com origem `crm`.

**Tech Stack:** Next.js 16 (App Router), React 19, Postgres via `pg`, CSS Modules, testes em `node:test`.

**Spec:** `docs/superpowers/specs/2026-08-09-crm-cliente-design.md`

## Global Constraints

- **A regra do CRM continua valendo: toda ação é uma tela.** Proibido `alert`, `confirm`, `prompt`, `<dialog>`, modal, gaveta. **Nenhum alvo clicável abaixo de 48px.** `grep -rn "alert(\|confirm(\|prompt(" src/app/admin/crm` tem que continuar vazio.
- **Este Next.js NÃO é o do seu treino.** Leia `node_modules/next/dist/docs/` antes de escrever rota, página ou navegação. **`params` é assíncrono.**
- **O alias `@/` não resolve em `node --test`** — módulo com teste próprio é puro, sem imports (ou importando vizinhos puros por caminho relativo com extensão `.js`).
- Arquivo de teste é **`.test.mjs`**.
- **`admin.module.css` não ganha classe nova.** No `crm.module.css`, nada de `@media (max-width:)` nem tema escuro.
- **Nenhuma oportunidade existente pode ser alterada ou migrada.** `cliente_nome` continua `not null` e continua sendo o que a lista mostra quando não há vínculo.
- **`acoesDaEtapa` continua sendo a fonte única** das ações do funil. Tela não decide, tela pergunta.
- Cópia em português do Brasil.
- Rode `npm test` (247 testes) e `npm run build` antes de commitar cada task.

---

### Task 1: Schema e regras puras

**Files:**
- Modify: `db/crm-schema.sql` (coluna `cliente_id`)
- Modify: `db/clientes-schema.sql` (a origem `crm`)
- Create: `src/lib/crm/vinculoCliente.js`
- Test: `tests/crm-vinculo-cliente.test.mjs`
- Test: `tests/crm-cliente-schema.test.mjs`

**Interfaces:**
- Produces: `dadosDoCliente(cliente)`, `precisaVincular(oportunidade)`.

- [ ] **Step 1: A coluna no CRM**

Em `db/crm-schema.sql`, depois do `create table`, no padrão idempotente que os outros `.sql` do projeto usam:

```sql
alter table oportunidades add column if not exists cliente_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'oportunidades_cliente_fk') then
    -- set null, não cascade: apagar o cadastro do cliente não pode apagar a
    -- oportunidade, que é o histórico da negociação.
    alter table oportunidades add constraint oportunidades_cliente_fk
      foreign key (cliente_id) references clientes(id) on delete set null;
  end if;
end $$;
create index if not exists oport_cliente_idx on oportunidades(cliente_id) where cliente_id is not null;
```

**Cuidado com a ordem de aplicação:** `oportunidades` referencia `clientes`, então `db/clientes-schema.sql` precisa ter rodado antes. Confira se algum script ou documento do repo fixa a ordem de aplicação dos `.sql` e, se fixar, ajuste — e diga no relatório.

- [ ] **Step 2: A origem `crm`**

`db/clientes-schema.sql` cria `cliente_veiculos` com `check (origem in ('manual','contrato','nota'))`. Precisa aceitar `'crm'`.

**Duas mudanças, não uma:** o `check` dentro do `create table` (para banco novo) **e** uma recriação idempotente (para os bancos que já existem, onde o `create table if not exists` não muda nada):

```sql
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'cliente_veiculo_origem_check') then
    alter table cliente_veiculos drop constraint cliente_veiculo_origem_check;
  end if;
  alter table cliente_veiculos add constraint cliente_veiculo_origem_check
    check (origem in ('manual','contrato','nota','crm'));
end $$;
```

Deixe um comentário dizendo por que existe nos dois lugares — parece duplicação e não é.

- [ ] **Step 3: Aplicar e conferir idempotência**

```bash
psql "$DATABASE_URL" -f db/clientes-schema.sql
psql "$DATABASE_URL" -f db/crm-schema.sql
psql "$DATABASE_URL" -f db/clientes-schema.sql   # 2ª vez
psql "$DATABASE_URL" -f db/crm-schema.sql        # 2ª vez
psql "$DATABASE_URL" -c "\d oportunidades" | grep -i cliente_id
psql "$DATABASE_URL" -c "select pg_get_constraintdef(oid) from pg_constraint where conname='cliente_veiculo_origem_check';"
```

Expected: as quatro aplicações sem erro; a coluna presente; o `check` citando `crm`.

- [ ] **Step 4: O módulo puro**

`src/lib/crm/vinculoCliente.js`, sem imports:

```js
/**
 * O que o CRM copia de um cliente cadastrado, e como saber que falta vincular.
 *
 * Puro de propósito (sem I/O e sem imports): usado na tela e no teste, que roda
 * em `node --test`, onde o alias "@/" não resolve.
 */

/** Campos que o seletor copia do cadastro para a oportunidade. */
export function dadosDoCliente(cliente) {
  const c = cliente || {};
  return {
    cliente_id: c.id || null,
    cliente_nome: String(c.nome ?? "").trim(),
    telefone: String(c.telefone ?? "").trim(),
    email: String(c.email ?? "").trim(),
  };
}

/** Oportunidade que ainda não aponta para um cliente do cadastro. */
export function precisaVincular(oportunidade) {
  return !oportunidade?.cliente_id;
}
```

- [ ] **Step 5: `tests/crm-vinculo-cliente.test.mjs`**

Casos de `dadosDoCliente`: cliente completo (os quatro campos); sem telefone e sem e-mail (**strings vazias, nunca `undefined`** — vão para um input controlado); `null`; e um cliente cujo nome tem espaços em volta (tem que vir aparado).

Casos de `precisaVincular`: com `cliente_id`; sem; `cliente_id` vazio (`""`); oportunidade `null`.

- [ ] **Step 6: `tests/crm-cliente-schema.test.mjs`**

No padrão de `tests/clientes-schema.test.mjs` — **leia o arquivo antes**. Banco descartável; aplique `schema.sql`, `auth-schema.sql`, `clientes-schema.sql`, `crm-schema.sql` **nessa ordem**.

Casos, todos com corpo real:
- oportunidade com `cliente_id` nulo é aceita;
- apagar o cliente **deixa a oportunidade viva** com `cliente_id` nulo (é o `set null`);
- `cliente_veiculos` aceita `origem = 'crm'`;
- `cliente_veiculos` continua recusando uma origem inventada (o `assert.rejects` tem que casar `/cliente_veiculo_origem_check/`).

- [ ] **Step 7: Rodar, buildar, commitar**

```bash
npm test && npm run build
git add db src/lib/crm/vinculoCliente.js tests/crm-vinculo-cliente.test.mjs tests/crm-cliente-schema.test.mjs
git commit -m "feat: oportunidade aponta para cliente cadastrado, e vínculo aceita origem crm"
```

---

### Task 2: Repositório, autorização e o vínculo na venda

**Files:**
- Modify: `src/lib/crm/oportunidades.js` (`SELECT`, `normalize`, `create`, `update`)
- Modify: `src/app/api/admin/clientes/route.js` (POST libera `vendedor`)
- Modify: `src/app/api/admin/crm/oportunidades/[id]/route.js` (vínculo no `registrar-venda`)
- Modify: `tests/clientes-autorizacao.test.mjs` (a fronteira nova)

- [ ] **Step 1: O repositório enxerga o cliente**

Em `src/lib/crm/oportunidades.js`:
- `SELECT`: acrescente `o.cliente_id` e, do join novo com `clientes`, `c.nome as cliente_cadastrado_nome`. **Não remova `o.cliente_nome`** — ele continua sendo o rótulo.
- `normalize`: aceite `cliente_id` (vazio/inválido vira `null`).
- `INSERT` e `UPDATE`: incluam a coluna. **Conte os placeholders e os valores dos dois comandos e confirme que batem** — renumerar errado grava valor em coluna errada sem dar erro. A contagem vai no relatório.

- [ ] **Step 2: O vendedor pode criar cliente**

Em `src/app/api/admin/clientes/route.js`, **só o `POST`** passa a aceitar `vendedor`:

```js
// O vendedor cadastra cliente de dentro do CRM — lead no pátio não espera.
// Mas continua sem PUT/PATCH/DELETE e sem a ficha: administrar cadastro é da
// secretaria e do financeiro. Ver a spec desta entrega.
const auth = await requireApiRole(["secretaria", "financeiro", "vendedor"]);
```

**Não toque nas outras guardas.** `PUT`, `PATCH`, `DELETE` e o `GET` da ficha (`[id]/route.js`) continuam sem `vendedor` — o `GET` da ficha carrega notas fiscais, e foi fechado de propósito.

Em `src/lib/auth/permissions.js`, **a seção `clientes` NÃO muda** — o vendedor continua sem o menu.

- [ ] **Step 3: O teste que prende a fronteira**

Em `tests/clientes-autorizacao.test.mjs`, ajuste a matriz: `vendedor` passa no `POST /api/admin/clientes` e **continua recebendo 403** em `PUT`, `PATCH`, `DELETE` e no `GET` de `[id]`.

**Prove que o teste não é vazio:** depois de passar, tire `"vendedor"` do `POST`, confirme que o teste quebra, e reverta. Diga no relatório qual foi a falha.

- [ ] **Step 4: Vender pelo CRM liga o carro ao cliente**

Em `src/app/api/admin/crm/oportunidades/[id]/route.js`, no ramo `action === "registrar-venda"`, **depois** de a venda ser registrada com sucesso: se a oportunidade tiver `cliente_id` **e** `vehicle_id`, chame `ligarVeiculo` de `@/lib/clientes/repo` com `papel: "comprou"` e `origem: "crm"`.

Em `try/catch` que **só registra o erro**, como os outros dois caminhos fazem — leia `src/lib/documentos.js` e `src/lib/fiscal/notas.js` para ver a forma. **Uma venda registrada não pode virar erro porque o vínculo falhou.**

Não passe `documentoId`: aquela coluna referencia `documentos_gerados` e a venda pelo CRM não gera documento.

- [ ] **Step 5: Rodar, buildar, commitar**

```bash
npm test && npm run build
git add src/lib/crm src/app/api/admin tests/clientes-autorizacao.test.mjs
git commit -m "feat: CRM grava o cliente cadastrado e a venda liga o carro à ficha dele"
```

---

### Task 3: As telas do CRM

**Files:**
- Modify: `src/app/admin/crm/FormOportunidade.js`
- Modify: `src/app/admin/crm/[id]/page.js` e `AcoesCard.js`
- Create: `src/app/admin/crm/[id]/vincular/page.js` (+ o client component que precisar)
- Modify: `src/app/admin/crm/page.js` (marca de pendência)
- Modify: `src/app/admin/crm/crm.module.css`

- [ ] **Step 1: O campo de cliente vira busca**

No formulário, o campo de nome do cliente ganha busca no cadastro. Digitando, chama `GET /api/admin/clientes?busca=<termo>` (com um atraso curto, como a tela de Clientes já faz — **leia `src/app/admin/clientes/ClientesClient.js`** e siga o mesmo mecanismo) e mostra os que casam.

Escolher um: aplica `dadosDoCliente(cliente)` e guarda o `cliente_id`.

Nada casou e o nome está preenchido: aparece **"Cadastrar «nome» como cliente novo"**, que faz `POST /api/admin/clientes` com nome e telefone e já vincula o que voltou.

**Esta é a proteção contra cadastro duplicado, e é o motivo de a busca existir** — achar tem que ser mais fácil que criar. Se o resultado da busca ficar escondido ou difícil de tocar, a proteção não funciona. Os itens do resultado seguem a regra: **48px de altura, no mínimo**.

Se o `POST` voltar 403 (papel sem permissão de escrita), mostre a mensagem na tela, nunca `alert`.

- [ ] **Step 2: A tela da oportunidade**

Com cliente vinculado: o nome vira link para `/admin/clientes/<id>`, com uma linha curta dizendo quantos carros já passaram por ele. **Cuidado:** a ficha do cliente é de secretaria/financeiro/admin — para o **vendedor** esse link levaria a um redirecionamento. Mostre o link **só para quem pode abrir**; para o vendedor, mostre o nome sem link. Descubra o papel pela prop que a página já recebe do servidor, ou passe-o; **não** adivinhe pelo erro.

Sem vínculo: uma ação **"Vincular a um cliente"**, largura total, levando a `/admin/crm/<id>/vincular`.

- [ ] **Step 3: A tela de vincular**

`/admin/crm/[id]/vincular`: busca de cliente igual à do formulário, cada resultado um alvo de 48px que vincula (`PUT` na oportunidade com o `cliente_id`) e volta para o card. Um "Cancelar" que volta sem mexer.

Se o nome digitado na oportunidade não achar ninguém, ofereça cadastrar — mesma ação do formulário.

- [ ] **Step 4: A marca na lista**

Na lista, oportunidade com `precisaVincular(o)` verdadeiro ganha uma marca **discreta** ("sem cadastro", em texto pequeno e cinza). **Não é erro, é pendência** — não use vermelho nem ícone de alerta. Serve para a secretaria saber o que falta.

- [ ] **Step 5: Verificar por leitura**

Você não tem navegador. No relatório: liste cada clicável novo com a altura garantida pelo CSS; cole `grep -rn "alert(\|confirm(\|prompt(" src/app/admin/crm` (vazio); e diga o que a tela da oportunidade mostra para cada papel (vendedor, secretaria, admin).

- [ ] **Step 6: Rodar, buildar, commitar**

```bash
npm test && npm run build
git add src/app/admin/crm
git commit -m "feat: CRM busca o cliente no cadastro, vincula e marca o que falta"
```

---

### Task 4: Ficha do cliente e tutoriais

**Files:**
- Modify: `src/lib/clientes/repo.js` (`getCliente` traz as oportunidades)
- Modify: `src/app/admin/clientes/[id]/FichaClient.js`
- Modify: `src/app/admin/tutoriais/crm/page.js`
- Modify: `src/app/admin/tutoriais/clientes/page.js`

- [ ] **Step 1: A ficha mostra as oportunidades**

Em `getCliente`, acrescente uma consulta de `oportunidades` do cliente (etapa, veículo, valor, data), no mesmo estilo das de `documentos` e `notas` que já estão lá.

Na ficha, um bloco **"Oportunidades"** ao lado dos que existem, com frase própria de vazio. Use `rotuloEtapa` de `@/lib/crm/etapas` para o nome da etapa — **não repita a tabela de rótulos**.

- [ ] **Step 2: Os tutoriais**

Os dois tutoriais que acabaram de ser escritos ficam desatualizados com esta entrega. **Leia cada um inteiro** e encaixe no fluxo, não no fim:

- **CRM:** o cliente da oportunidade pode vir do cadastro; o vendedor pode cadastrar dali; e **registrar a venda agora liga o carro à ficha do cliente** (antes não ligava — o tutorial atual não afirma o contrário, mas a informação nova é útil).
- **Clientes:** a ficha passa a mostrar as oportunidades do cliente, e o carro pode chegar à ficha por três caminhos: contrato, nota fiscal e agora venda pelo CRM.

- [ ] **Step 3: Rodar, buildar, commitar**

```bash
npm test && npm run build
git add src/lib/clientes src/app/admin/clientes src/app/admin/tutoriais
git commit -m "feat: ficha do cliente mostra as oportunidades, e tutoriais atualizados"
```

---

## Depois das tasks (com o controlador)

1. Revisão final da branch.
2. Navegador em 390px, caminho completo: criar oportunidade cadastrando cliente novo pelo CRM → avançar até Ganho → registrar a venda → **conferir que o carro apareceu na ficha do cliente** com origem `crm`.
3. Conferir como vendedor: consegue cadastrar cliente pelo CRM, **não** vê o menu Clientes, **não** abre a ficha.
4. Deploy: `clientes-schema.sql` **antes** de `crm-schema.sql` (a FK depende), ambos antes do build.
