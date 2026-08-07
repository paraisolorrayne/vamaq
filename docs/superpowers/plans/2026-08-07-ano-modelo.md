# Ano de fabricação / ano do modelo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O veículo passa a ter ano de fabricação e ano do modelo (2021/2022), exibidos no estoque, no contrato e no site público.

**Architecture:** `vehicles.year` continua sendo o ano de fabricação e **não muda de comportamento em lugar nenhum**; entra uma coluna nova `ano_modelo integer null`. Uma função pura decide como os dois viram texto na tela. Veículo sem ano de modelo exibe exatamente o que exibia antes.

**Tech Stack:** Next.js 16 (App Router), React 19, Postgres via `pg`, CSS Modules, testes em `node:test`.

**Spec:** `docs/superpowers/specs/2026-08-07-ano-modelo-design.md`

## Global Constraints

- **Este Next.js não é o do seu treino.** Leia `node_modules/next/dist/docs/` antes de escrever código de rota, página ou action. `params` é assíncrono.
- **O alias `@/` NÃO resolve em `node --test`.** Módulo com teste próprio é puro, sem imports (padrão de `src/lib/rh/cpf.js`, `src/lib/buscaVeiculo.js`, `src/lib/documentosCliente.js`).
- **Arquivo de teste é `.test.mjs`.** O `npm test` roda `tests/*.test.mjs`; um `.test.js` é ignorado em silêncio.
- **Nenhuma classe nova em `admin.module.css`.** Use as existentes; ajuste pontual em `style={{}}` inline. **`formGroupFull` nunca vai sozinho**, sempre pareado com `formGroup`.
- **Nada pode mudar para um veículo sem `ano_modelo`.** Essa é a regra que governa a entrega inteira: filtros, ordenação, slug e toda tela existente continuam idênticos quando a coluna nova está nula.
- **Não toque no slug.** `slugify` em `src/lib/vehicleStore.js` continua usando só `year`. URLs já indexadas não podem mudar.
- **Não toque nos filtros nem na ordenação** do acervo (`src/lib/repositories/vehicles.js`, `src/app/acervo/AcervoClient.js`) — continuam comparando `year`.
- **Fora de escopo:** Gerar Criativos e a descrição do item da NF-e (`src/lib/fiscal/payload.js`). Não mexa nesses arquivos.
- Cópia em português do Brasil.
- Rode `npm test` (151 testes) e `npm run build` antes de commitar cada task.

---

### Task 1: A coluna, a constraint e a função de exibição

**Files:**
- Create: `src/lib/anoVeiculo.js`
- Modify: `db/schema.sql` (bloco de `alter table` no fim do arquivo)
- Test: `tests/ano-veiculo.test.mjs`
- Test: `tests/ano-modelo-schema.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `anoVeiculo(veiculo) -> string` — usado por todas as tasks seguintes.

- [ ] **Step 1: Escrever `tests/ano-veiculo.test.mjs`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { anoVeiculo } from "../src/lib/anoVeiculo.js";

test("sem ano de modelo, mostra só o de fabricação", () => {
  assert.equal(anoVeiculo({ year: 2021 }), "2021");
  assert.equal(anoVeiculo({ year: 2021, ano_modelo: null }), "2021");
});

test("com ano de modelo diferente, mostra os dois", () => {
  assert.equal(anoVeiculo({ year: 2021, ano_modelo: 2022 }), "2021/2022");
});

test("ano de modelo igual ao de fabricação não repete", () => {
  assert.equal(anoVeiculo({ year: 2022, ano_modelo: 2022 }), "2022");
});

test("aceita string vinda do formulário", () => {
  assert.equal(anoVeiculo({ year: "2021", ano_modelo: "2022" }), "2021/2022");
  assert.equal(anoVeiculo({ year: "2022", ano_modelo: "2022" }), "2022");
});

test("sem ano de fabricação devolve string vazia", () => {
  assert.equal(anoVeiculo({}), "");
  assert.equal(anoVeiculo(null), "");
  assert.equal(anoVeiculo({ ano_modelo: 2022 }), "");
});

test("ano de modelo vazio ou zero é tratado como ausente", () => {
  assert.equal(anoVeiculo({ year: 2021, ano_modelo: "" }), "2021");
  assert.equal(anoVeiculo({ year: 2021, ano_modelo: 0 }), "2021");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Escrever `src/lib/anoVeiculo.js`**

```js
/**
 * Como o ano do veículo aparece na tela: "2021" ou "2021/2022".
 *
 * Puro de propósito (sem I/O e sem imports): é usado no painel, no site
 * público e no teste, que roda em `node --test`, onde o alias "@/" não resolve.
 *
 * `year` é o ano de FABRICAÇÃO e continua sendo o único usado em filtro,
 * ordenação e slug. `ano_modelo` é opcional — sem ele, a saída é idêntica ao
 * que o sistema exibia antes desta coluna existir.
 */

export function anoVeiculo(veiculo) {
  const fabricacao = Number(veiculo?.year) || 0;
  if (!fabricacao) return "";
  const modelo = Number(veiculo?.ano_modelo) || 0;
  // Igual não repete: "2022/2022" é ruído, quem cadastrou os dois iguais
  // quis dizer "é o mesmo ano".
  if (!modelo || modelo === fabricacao) return String(fabricacao);
  return `${fabricacao}/${modelo}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS, 151 + os novos.

- [ ] **Step 5: A coluna e a constraint**

Em `db/schema.sql`, no bloco idempotente do fim do arquivo (onde já estão os
`alter table vehicles add column if not exists` de `status`, `placa`, `documentos`
e `renave` — **leia esse bloco antes**), acrescente:

```sql
alter table vehicles add column if not exists ano_modelo integer;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ano_modelo_check') then
    -- O ano do modelo nunca é anterior ao de fabricação. Não travamos em
    -- year + 1: existe carro fabricado em dezembro com modelo dois anos à
    -- frente, e uma trava esperta aqui vira chamado de suporte depois.
    alter table vehicles add constraint ano_modelo_check
      check (ano_modelo is null or (ano_modelo between 1950 and 2036 and ano_modelo >= year));
  end if;
end $$;
```

- [ ] **Step 6: Aplicar e conferir idempotência**

```bash
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/schema.sql   # segunda vez tem que passar igual
psql "$DATABASE_URL" -c "\d vehicles" | grep -i ano_modelo
```

- [ ] **Step 7: Escrever `tests/ano-modelo-schema.test.mjs`**

Copie a estrutura de `tests/clientes-schema.test.mjs` — **leia esse arquivo
antes**: ele cria um banco descartável, aplica os `.sql` e derruba no `after`.
Use `const TEST_DB = "vamaq_ano_modelo_test";` e a lista `["schema.sql"]`.

Casos:

```js
test("ano_modelo nulo é aceito", async () => { /* insert sem a coluna */ });
test("ano_modelo igual ao de fabricação é aceito", async () => { /* 2022 / 2022 */ });
test("ano_modelo um ano à frente é aceito", async () => { /* 2021 / 2022 */ });
test("ano_modelo anterior ao de fabricação é recusado", async () => {
  await assert.rejects(() => novoVeiculo({ year: 2022, ano_modelo: 2021 }), /ano_modelo_check/);
});
test("ano_modelo fora da faixa é recusado", async () => {
  await assert.rejects(() => novoVeiculo({ year: 2021, ano_modelo: 2100 }), /ano_modelo_check/);
});
```

Escreva o corpo de todos — nenhum pode ficar vazio. A regex tem que casar o nome
da constraint; regex frouxa não prova nada.

- [ ] **Step 8: Rodar tudo e commitar**

```bash
npm test && npm run build
git add src/lib/anoVeiculo.js db/schema.sql tests/ano-veiculo.test.mjs tests/ano-modelo-schema.test.mjs
git commit -m "feat: coluna ano_modelo e função de exibição do ano do veículo"
```

---

### Task 2: Cadastro e edição do veículo

**Files:**
- Modify: `src/lib/vehicleStore.js` (`normalize`, `SELECT_COLS`, `INSERT`, `UPDATE`, `rowToVehicle` se houver)
- Modify: `src/app/admin/estoque/novo/page.js` (estado inicial e o campo do formulário)

**Interfaces:**
- Consumes: nada de Task 1 (esta task não exibe, só grava).
- Produces: `ano_modelo` gravado e devolvido pelas leituras do painel.

- [ ] **Step 1: `normalize` aceita a coluna nova**

Em `src/lib/vehicleStore.js`, na função `normalize`, ao lado da linha de `year`:

```js
    // Opcional: vazio, zero ou lixo viram null — a coluna é nullable e o
    // veículo sem ano de modelo tem que continuar se comportando como antes.
    ano_modelo: Math.round(Number(body.ano_modelo)) || null,
```

**Não mude a linha de `year`.** Ela continua com o mesmo fallback para o ano
corrente.

- [ ] **Step 2: A coluna entra no SELECT, no INSERT e no UPDATE**

- `SELECT_COLS` (topo do arquivo): acrescente `ano_modelo` logo depois de `year`.
- O `insert into vehicles (...)`: acrescente a coluna e o `$N` correspondente.
  **Renumere todos os placeholders seguintes com cuidado** — errar aqui grava
  valor em coluna errada e não dá erro nenhum.
- O `update vehicles set ...`: acrescente `ano_modelo=$N`, mesma atenção.

Depois de editar, **conte os placeholders e os valores do array e confira que
batem**, nos dois comandos. Diga a contagem no relatório.

- [ ] **Step 3: O campo no formulário**

Em `src/app/admin/estoque/novo/page.js`:

- No estado inicial, ao lado de `year: new Date().getFullYear()`, acrescente
  `ano_modelo: ""`.
- O campo atual tem label **"Ano *"**. Ele passa a ser **"Ano de fabricação *"**.
- Ao lado dele, um campo novo **"Ano do modelo"** (sem asterisco — é opcional),
  `<input type="number">`, `onChange` chamando `handleChange("ano_modelo", e.target.value)`,
  com `placeholder="opcional"`.
- Os dois usam a mesma estrutura de `formGroup` do campo de ano atual — copie a
  forma do vizinho, não invente marcação nova.
- Abaixo do campo novo, uma linha de ajuda curta: "Deixe em branco se for igual ao
  ano de fabricação."

- [ ] **Step 4: Provar no navegador não é seu — provar por leitura é**

Você não tem navegador. No relatório, mostre:
1. a contagem de placeholders x valores do INSERT e do UPDATE (Step 2);
2. que `normalize` devolve `null` para `ano_modelo` quando o campo vem vazio,
   `"0"`, ou ausente;
3. que nenhuma outra chamada de `normalize` no arquivo foi afetada.

- [ ] **Step 5: Build, suíte e commit**

```bash
npm test && npm run build
git add src/lib/vehicleStore.js src/app/admin/estoque/novo/page.js
git commit -m "feat: cadastro de veículo aceita ano do modelo"
```

---

### Task 3: Estoque e contrato

**Files:**
- Modify: `src/app/admin/estoque/page.js` (tabela e card mobile)
- Modify: `src/app/admin/documentos/page.js` (`fillFromVehicle`)

**Interfaces:**
- Consumes: `anoVeiculo` de `@/lib/anoVeiculo` (Task 1); `ano_modelo` vindo das leituras (Task 2).

- [ ] **Step 1: A lista do estoque**

Em `src/app/admin/estoque/page.js`, importe `anoVeiculo` de `@/lib/anoVeiculo` e
troque as duas exibições do ano (a `<td>` da tabela e a linha do card mobile) por
`{anoVeiculo(v)}`.

**Confira antes** se a busca do estoque filtra por ano — se filtrar, **não mexa no
filtro**, só na exibição.

- [ ] **Step 2: O preenchimento automático do contrato**

Em `src/app/admin/documentos/page.js`, em `fillFromVehicle`, a linha:

```js
      [`${prefix}_ano`]: String(v.year) || prev[`${prefix}_ano`],
```

passa a usar `anoVeiculo(v)`:

```js
      [`${prefix}_ano`]: anoVeiculo(v) || prev[`${prefix}_ano`],
```

Importe `anoVeiculo` de `@/lib/anoVeiculo`. O campo do contrato é texto livre e
continua editável — nada mais muda ali.

**Confira** que a lista de veículos que alimenta essa tela (`/api/admin/vehicles`)
devolve `ano_modelo` depois da Task 2. Se não devolver, o preenchimento cai no ano
de fabricação sozinho, sem erro — e é exatamente o tipo de falha silenciosa que
precisa ser pega aqui. Diga no relatório de onde vem a lista e se ela traz a coluna.

- [ ] **Step 3: Build, suíte e commit**

```bash
npm test && npm run build
git add src/app/admin/estoque/page.js src/app/admin/documentos/page.js
git commit -m "feat: estoque e contrato mostram o ano no formato fabricação/modelo"
```

---

### Task 4: Site público

**Files:**
- Modify: `src/lib/repositories/vehicles.js` (o `SELECT`)
- Modify: `src/components/VehicleCard.js`
- Modify: `src/components/VehicleDetailView.js`
- Modify: `src/app/veiculo/[slug]/page.js` (título e og:title)
- Modify: `src/app/page.js` (home)
- Modify: `src/lib/whatsapp.js`

**Interfaces:**
- Consumes: `anoVeiculo` de `@/lib/anoVeiculo`.

- [ ] **Step 1: A coluna chega ao site**

Em `src/lib/repositories/vehicles.js`, acrescente `ano_modelo` à lista de colunas
do `SELECT`, logo depois de `year`. Se houver um `rowToVehicle` mapeando campo a
campo, inclua lá também.

**Não toque nos filtros `minYear`/`maxYear` nem na ordenação por `year`.** Eles
continuam comparando o ano de fabricação, por decisão da spec.

- [ ] **Step 2: As telas**

Troque a exibição do ano por `anoVeiculo(...)` em:
- `src/components/VehicleCard.js`
- `src/components/VehicleDetailView.js`
- `src/app/page.js`
- `src/lib/whatsapp.js` (a mensagem pronta de interesse)

Em `src/app/veiculo/[slug]/page.js`, o `title` e o `og:title` passam a usar a forma
composta.

**`src/lib/whatsapp.js` pode ser puro** (sem imports) — confira antes de importar
`anoVeiculo` com o alias `@/`. Se for puro e tiver teste, use import relativo com
extensão `.js`; se não tiver teste e já importar com alias, siga o padrão do
arquivo.

- [ ] **Step 3: Caçar o que ficou para trás**

Rode `grep -rn "\.year" src/components src/app/veiculo src/app/acervo src/app/page.js src/lib/whatsapp.js` e liste no relatório **cada ocorrência restante**, dizendo por que ficou (filtro, ordenação, ou exibição que você trocou). Uma exibição esquecida mostra "2021" numa tela e "2021/2022" na vizinha.

- [ ] **Step 4: Build, suíte e commit**

```bash
npm test && npm run build
git add src/lib/repositories/vehicles.js src/components src/app/veiculo src/app/page.js src/lib/whatsapp.js
git commit -m "feat: site público mostra o ano no formato fabricação/modelo"
```

---

## Depois das tasks (com o controlador)

1. Revisão final da branch.
2. Navegador contra banco local: cadastrar um veículo com 2021/2022 e outro só com
   2021, e conferir **as duas formas** em estoque, contrato, card do acervo, página
   do veículo, título da aba e link de WhatsApp. O veículo sem ano de modelo tem que
   estar idêntico ao que era antes.
3. Conferir que o filtro "Até (ano)" do acervo continua funcionando como antes.
4. Deploy: `db/schema.sql` aplicado **antes** do `npm run build`.
