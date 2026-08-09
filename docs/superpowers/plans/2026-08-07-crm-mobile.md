# CRM 100% mobile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O CRM vira sete telas pensadas para o celular, sem nenhum popup e sem nenhum alvo de toque pequeno.

**Architecture:** Cada `page.js` é Server Component e lê direto do repositório (`@/lib/crm/oportunidades`) — sem piscada de "Carregando…". As mutações continuam indo pelas rotas de API que já existem, chamadas de componentes cliente pequenos. É o mesmo desenho que o cadastro de clientes já usa neste repo.

**Tech Stack:** Next.js 16 (App Router), React 19, Postgres via `pg`, CSS Modules, testes em `node:test`.

**Spec:** `docs/superpowers/specs/2026-08-07-crm-mobile-design.md`

## Global Constraints

- **A REGRA DA ENTREGA: toda ação é uma tela.** Proibido `alert()`, `confirm()`, `prompt()`, `<dialog>`, modal, gaveta ou sobreposição de qualquer tipo. Se você se pegar escrevendo um deles, a resposta certa é uma rota nova.
- **Nenhum alvo clicável abaixo de 48px de altura.** Vale para botão, link que age como botão, e a linha "Editar · Mover · Remover".
- **Este Next.js NÃO é o do seu treino.** Leia `node_modules/next/dist/docs/` antes de escrever página, layout, `generateMetadata` ou navegação. **`params` é assíncrono** (`const { id } = await params`). Componente com `useSearchParams` precisa de `<Suspense>`.
- **O CSS novo vai em `src/app/admin/crm/crm.module.css`**, que pode ser reescrito à vontade — as classes do quadro (`board`, `column`, `colHead`, `moveSelect`, `iconBtn`…) morrem com esta entrega. **`admin.module.css` não ganha classe nova**; use as que já existem (`pageHeader`, `pageTitle`, `pageSubtitle`, `card`, `formGroup`, `formLabel`, `formInput`, `formSelect`, `btnPrimary`, `btnSecondary`, `btnDanger`, `backLinkContent`).
- **`formGroupFull` nunca vai sozinho** — sempre pareado com `formGroup`.
- **Mobile-first:** escreva o CSS para a tela estreita e use `@media (min-width: …)` para alargar no desktop. Não o contrário.
- Cópia em português do Brasil, frases curtas.
- Rode `npm test` (164 testes) e `npm run build` antes de commitar cada task.

---

### Task 1: Regras do funil, em módulo puro

**Files:**
- Create: `src/lib/crm/etapas.js`
- Test: `tests/crm-etapas.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `ETAPAS_INFO`, `proximaEtapa(etapa)`, `rotuloEtapa(etapa)`, `acoesDaEtapa(oportunidade)` — usados por todas as telas.

Este módulo é puro (sem imports) porque tem teste próprio e o alias `@/` não resolve em `node --test`. Mesmo padrão de `src/lib/anoVeiculo.js` e `src/lib/documentosCliente.js`.

- [ ] **Step 1: Escrever `tests/crm-etapas.test.mjs`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { proximaEtapa, rotuloEtapa, acoesDaEtapa } from "../src/lib/crm/etapas.js";

test("proximaEtapa percorre o funil na ordem", () => {
  assert.equal(proximaEtapa("novo"), "contato");
  assert.equal(proximaEtapa("contato"), "proposta");
  assert.equal(proximaEtapa("proposta"), "negociacao");
  assert.equal(proximaEtapa("negociacao"), "ganho");
});

test("as etapas terminais não têm próxima", () => {
  assert.equal(proximaEtapa("ganho"), null);
  assert.equal(proximaEtapa("perdido"), null);
});

test("etapa desconhecida ou vazia não tem próxima", () => {
  assert.equal(proximaEtapa("qualquer"), null);
  assert.equal(proximaEtapa(""), null);
  assert.equal(proximaEtapa(null), null);
});

test("rotuloEtapa devolve o nome por extenso", () => {
  assert.equal(rotuloEtapa("novo"), "Novo");
  assert.equal(rotuloEtapa("contato"), "Em contato");
  assert.equal(rotuloEtapa("proposta"), "Proposta");
  assert.equal(rotuloEtapa("negociacao"), "Negociação");
  assert.equal(rotuloEtapa("ganho"), "Ganho");
  assert.equal(rotuloEtapa("perdido"), "Perdido");
});

test("rotuloEtapa devolve o próprio valor se não conhecer a etapa", () => {
  assert.equal(rotuloEtapa("outra-coisa"), "outra-coisa");
  assert.equal(rotuloEtapa(""), "");
});

test("em novo: avança e pode perder, não vende", () => {
  const a = acoesDaEtapa({ etapa: "novo", vehicle_id: "abc", telefone: "34999" });
  assert.equal(a.avancarPara, "contato");
  assert.equal(a.podePerder, true);
  assert.equal(a.podeVender, false);
  assert.equal(a.podeReabrir, false);
});

test("em ganho COM veículo: vende, não avança", () => {
  const a = acoesDaEtapa({ etapa: "ganho", vehicle_id: "abc" });
  assert.equal(a.avancarPara, null);
  assert.equal(a.podeVender, true);
});

test("em ganho SEM veículo ligado: NÃO oferece registrar venda", () => {
  const a = acoesDaEtapa({ etapa: "ganho", vehicle_id: null });
  assert.equal(a.podeVender, false);
});

test("em perdido: só reabrir", () => {
  const a = acoesDaEtapa({ etapa: "perdido", vehicle_id: "abc", telefone: "34999" });
  assert.equal(a.avancarPara, null);
  assert.equal(a.podePerder, false);
  assert.equal(a.podeVender, false);
  assert.equal(a.podeReabrir, true);
});

test("WhatsApp só aparece quando há telefone", () => {
  assert.equal(acoesDaEtapa({ etapa: "novo", telefone: "34999" }).podeWhatsapp, true);
  assert.equal(acoesDaEtapa({ etapa: "novo", telefone: "" }).podeWhatsapp, false);
  assert.equal(acoesDaEtapa({ etapa: "novo" }).podeWhatsapp, false);
});

test("oportunidade nula não quebra e não oferece nada", () => {
  const a = acoesDaEtapa(null);
  assert.equal(a.avancarPara, null);
  assert.equal(a.podeVender, false);
  assert.equal(a.podeWhatsapp, false);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Escrever `src/lib/crm/etapas.js`**

```js
/**
 * Regras do funil do CRM: ordem das etapas, rótulos e quais ações a tela do
 * card oferece.
 *
 * Puro de propósito (sem I/O e sem imports): é usado nas telas e no teste, que
 * roda em `node --test`, onde o alias "@/" não resolve.
 *
 * `ganho` e `perdido` são terminais: saem do funil por caminhos próprios
 * (registrar venda / reabrir), não por "avançar".
 */

export const ETAPAS_INFO = [
  { key: "novo", label: "Novo" },
  { key: "contato", label: "Em contato" },
  { key: "proposta", label: "Proposta" },
  { key: "negociacao", label: "Negociação" },
  { key: "ganho", label: "Ganho" },
  { key: "perdido", label: "Perdido" },
];

// A sequência que "Avançar" percorre. `perdido` fica de fora: é saída lateral.
const FUNIL = ["novo", "contato", "proposta", "negociacao", "ganho"];

export function proximaEtapa(etapa) {
  const i = FUNIL.indexOf(etapa);
  if (i < 0 || i >= FUNIL.length - 1) return null;
  return FUNIL[i + 1];
}

export function rotuloEtapa(etapa) {
  const e = ETAPAS_INFO.find((x) => x.key === etapa);
  return e ? e.label : String(etapa ?? "");
}

/** O que a tela do card oferece, dado o estado da oportunidade. */
export function acoesDaEtapa(oportunidade) {
  const o = oportunidade || {};
  const etapa = o.etapa;
  return {
    avancarPara: proximaEtapa(etapa),
    // Registrar venda exige veículo ligado: sem ele a ação falha no servidor,
    // e um botão que falha é pior que um botão ausente.
    podeVender: etapa === "ganho" && Boolean(o.vehicle_id),
    podePerder: etapa !== "perdido",
    podeReabrir: etapa === "perdido",
    podeWhatsapp: Boolean(String(o.telefone ?? "").trim()),
  };
}
```

- [ ] **Step 4: Rodar, buildar e commitar**

```bash
npm test && npm run build
git add src/lib/crm/etapas.js tests/crm-etapas.test.mjs
git commit -m "feat: regras do funil do CRM em módulo puro e testado"
```

---

### Task 2: Três correções de base

**Files:**
- Modify: `src/app/api/admin/crm/oportunidades/route.js` (2 guardas)
- Modify: `src/app/api/admin/crm/oportunidades/[id]/route.js` (5 guardas)
- Modify: `src/lib/crm/oportunidades.js` (`normalize` e o `SELECT`)
- Test: `tests/crm-valor.test.mjs`

Três defeitos que existem hoje em produção, encontrados ao levantar o terreno. Nenhum é do redesenho — mas todos aparecem nas telas novas.

**Interfaces:**
- Produces: `vehicle_ano_modelo` em cada oportunidade listada; `valor` gravado corretamente.

- [ ] **Step 1: A secretaria consegue usar o CRM**

`src/lib/auth/permissions.js` dá a seção `crm` a `["vendedor", "secretaria"]`, mas as **sete** guardas das rotas exigem `["vendedor"]`. A secretaria abre a tela e vê um funil vazio, sem erro — tudo volta 403.

Em **todas as sete**, troque `requireApiRole(["vendedor"])` por `requireApiRole(["vendedor", "secretaria"])`. Confira que são sete (duas em `route.js`, cinco em `[id]/route.js`) e diga a contagem no relatório.

- [ ] **Step 2: O valor em formato brasileiro deixa de virar NaN**

`normalize` em `src/lib/crm/oportunidades.js` faz `Number(b.valor)`. O campo do formulário sugere `180.000,00`, e ao editar é preenchido com `formatValorBR(...)` — ou seja, o formato brasileiro é o caminho normal. `Number("180.000,00")` é `NaN`, e a coluna `numeric` do Postgres **aceita NaN**: o valor errado é gravado em silêncio e a tela mostra "R$ NaN".

O projeto já tem `parseValorBR` em `src/lib/money.js` — **leia a função antes** para saber o que ela devolve quando a entrada é vazia ou inválida. Use ela no lugar do `Number` cru, garantindo que:
- vazio, `null` e `undefined` continuam virando `null` (é campo opcional);
- `"180.000,00"` vira `180000`;
- `"180000"` continua virando `180000`;
- entrada que não dá número vira `null`, **nunca `NaN`**.

- [ ] **Step 3: O teste do valor**

`tests/crm-valor.test.mjs`. O `normalize` do repositório não é exportado e o arquivo importa `@/lib/db`, então ele não é testável direto. **Extraia a normalização do valor para uma função pura** — `valorDaOportunidade(bruto)` em `src/lib/crm/valor.js`, sem imports, importando `parseValorBR` só se ele também for puro (confira; se não for, reimplemente a regra mínima ali e diga isso no relatório).

Casos: `"180.000,00"` → `180000`; `"180000"` → `180000`; `"1.234,56"` → `1234.56`; `""` → `null`; `null` → `null`; `undefined` → `null`; `"abc"` → `null`; e um caso afirmando **explicitamente** que o resultado nunca é `NaN` (`assert.ok(!Number.isNaN(...))`).

- [ ] **Step 4: O ano do modelo chega ao CRM**

O `SELECT` de `src/lib/crm/oportunidades.js` traz `v.year as vehicle_year` mas não o ano do modelo. As telas novas mostram o veículo com o ano, e sem isso o CRM exibiria "2021" enquanto o estoque mostra "2021/2022".

Acrescente `v.ano_modelo as vehicle_ano_modelo` ao `SELECT`. As telas montarão o objeto para `anoVeiculo` com `{ year: o.vehicle_year, ano_modelo: o.vehicle_ano_modelo }`.

- [ ] **Step 5: Rodar, buildar e commitar**

```bash
npm test && npm run build
git add src/app/api/admin/crm src/lib/crm tests/crm-valor.test.mjs
git commit -m "fix: CRM — secretaria sem acesso, valor virando NaN e ano do modelo ausente"
```

---

### Task 3: A lista

**Files:**
- Rewrite: `src/app/admin/crm/page.js` (Server Component)
- Create: `src/app/admin/crm/ListaClient.js` **só se precisar** — a lista é estática, então provavelmente não precisa
- Rewrite: `src/app/admin/crm/crm.module.css`

**Interfaces:**
- Consumes: `listOportunidades` de `@/lib/crm/oportunidades`; `ETAPAS_INFO`, `rotuloEtapa` de `@/lib/crm/etapas`; `anoVeiculo` de `@/lib/anoVeiculo`; `formatValorBR` de `@/lib/money`.

- [ ] **Step 1: A página**

`page.js` vira Server Component. Guarda de papel no topo, no padrão de `src/app/admin/clientes/page.js` — **leia esse arquivo antes** —, com `["vendedor", "secretaria"]`. Carrega com `listOportunidades()`.

Estrutura:
- Cabeçalho: `pageTitle` "CRM — Funil de vendas", `pageSubtitle` "N oportunidade(s) em aberto" (aberto = fora de `ganho` e `perdido`).
- Botão **"+ Nova oportunidade"**, largura total, ligando para `/admin/crm/novo`.
- Para cada etapa de `ETAPAS_INFO`, **na ordem**, se houver pelo menos um card: um cabeçalho `NOVO · 3` (rótulo em maiúsculas + contagem) e os cards.
- **Etapa vazia não aparece.**
- Nenhuma oportunidade: uma frase ("Nenhuma oportunidade ainda.") e o botão de criar.

Cada card é um `<Link>` para `/admin/crm/<id>` envolvendo o conteúdo inteiro — **o card todo é o alvo**, não há botão dentro. Mostra: nome do cliente (destaque), veículo (`marca modelo ano`, usando `anoVeiculo({ year: o.vehicle_year, ano_modelo: o.vehicle_ano_modelo })`) ou "sem veículo", valor formatado, e origem. Em `perdido`, mostra também o motivo.

- [ ] **Step 2: O CSS, mobile-first**

Reescreva `crm.module.css`. As classes do quadro morrem. O novo:
- `.novoBtn` — largura total, altura mínima 52px.
- `.grupo` / `.grupoHead` — cabeçalho de etapa: maiúsculas, letra pequena, cor discreta, contagem ao lado.
- `.card` — bloco de largura total, `display: block`, `min-height: 76px`, padding generoso, `text-decoration: none`, borda esquerda colorida por etapa (aproveite as cores que o arquivo antigo usava para `ganho` e `perdido`).
- `.cardNome`, `.cardMeta`, `.cardValor` — pode aproveitar os tamanhos do arquivo antigo.
- No fim, **e só no fim**, `@media (min-width: 900px)` colocando os cards de cada grupo numa grade de 2 ou 3 colunas e limitando a largura da página.

**Nada de `@media (max-width: …)`** — o arquivo é escrito do estreito para o largo.

- [ ] **Step 3: Verificar por leitura**

Você não tem navegador. No relatório, liste **cada elemento clicável** da tela e a altura mínima que o CSS garante para ele. Qualquer um abaixo de 48px é defeito seu.

- [ ] **Step 4: Rodar, buildar e commitar**

```bash
npm test && npm run build
git add src/app/admin/crm
git commit -m "feat: CRM — lista mobile agrupada por etapa, sem quadro horizontal"
```

---

### Task 4: A tela do card

**Files:**
- Create: `src/app/admin/crm/[id]/page.js` (Server Component)
- Create: `src/app/admin/crm/[id]/AcoesCard.js` (Client Component — só os botões que agem)
- Modify: `src/app/admin/crm/crm.module.css` (classes das ações)

**Interfaces:**
- Consumes: `getOportunidade`; `acoesDaEtapa`, `rotuloEtapa` de `@/lib/crm/etapas`; `anoVeiculo`.

- [ ] **Step 1: A página**

`const { id } = await params` (**assíncrono**). Guarda de papel. `getOportunidade(id)`; se não achar, `notFound()`.

Mostra, de cima para baixo: link "← Voltar" para `/admin/crm`; nome do cliente como título; a **etapa atual em destaque**; e os dados — veículo com ano, valor, origem, telefone, e-mail, observações. Campo sem valor não vira linha vazia: ou some, ou mostra "—".

- [ ] **Step 2: As ações**

`AcoesCard.js` (`"use client"`) recebe a oportunidade e renderiza os botões conforme `acoesDaEtapa(o)`:

1. `avancarPara` → botão primário, largura total: **"Avançar para «rótulo»"**. Chama `PATCH /api/admin/crm/oportunidades/<id>` com `{ etapa: avancarPara }` e, no sucesso, `router.refresh()`.
2. `podeWhatsapp` → link, largura total: **"Chamar no WhatsApp"**, abrindo `https://wa.me/<telefone só dígitos>?text=<mensagem>`. A mensagem cita o veículo quando houver. **Leia `src/lib/whatsapp.js`** e reaproveite o que der em vez de reinventar a montagem do link.
3. `podeVender` → link para `/admin/crm/<id>/vender`.
4. `podePerder` → link para `/admin/crm/<id>/perder`.
5. `podeReabrir` → botão que faz `PATCH` com `{ etapa: "novo" }`.
6. Por fim, a linha **Editar · Mover · Remover**, três links de igual largura para `/editar`, `/mover` e `/remover`, cada um com **48px de altura mínima** e área clicável cheia — não são links de texto soltos.

Erro de rede mostra uma frase na própria tela, **nunca `alert()`**.

- [ ] **Step 3: Verificar por leitura**

Mesma prova da Task 3: liste cada clicável e a altura garantida. Liste também, para cada uma das seis combinações de etapa, quais botões aparecem — e confirme que bate com os testes de `acoesDaEtapa`.

- [ ] **Step 4: Rodar, buildar e commitar**

```bash
npm test && npm run build
git add src/app/admin/crm
git commit -m "feat: CRM — tela do card com ações grandes e o próximo passo por extenso"
```

---

### Task 5: Novo e editar

**Files:**
- Create: `src/app/admin/crm/novo/page.js` + `FormOportunidade.js` (compartilhado)
- Create: `src/app/admin/crm/[id]/editar/page.js`

**Interfaces:**
- Consumes: `getOportunidade`; a lista de veículos de `/api/admin/vehicles`; `anoVeiculo`.

- [ ] **Step 1: O formulário compartilhado**

`FormOportunidade.js` (`"use client"`) recebe `valoresIniciais` e `oportunidadeId` (nulo em criação) e serve às duas telas. **Um formulário só para os dois casos** — a entrega anterior deste repo deixou dois formulários duplicados de cliente e isso virou dívida registrada; não repita aqui.

Campos, um por linha em tela estreita: cliente (obrigatório), telefone, e-mail, veículo (select), valor, origem (select), observações (textarea). Botão **Salvar** de largura total; **Cancelar** volta.

`POST /api/admin/crm/oportunidades` ou `PUT .../<id>`. Erro aparece na tela, nunca em `alert()`.

- [ ] **Step 2: As duas páginas**

`novo/page.js`: Server Component com guarda, renderiza o formulário vazio.
`[id]/editar/page.js`: `const { id } = await params`, `getOportunidade(id)`, `notFound()` se não achar, e passa os valores. O valor monetário vai formatado com `formatValorBR` (é o que a pessoa espera ver) — e a Task 2 garantiu que volta correto do servidor.

- [ ] **Step 3: Rodar, buildar e commitar**

```bash
npm test && npm run build
git add src/app/admin/crm
git commit -m "feat: CRM — telas de nova oportunidade e edição"
```

---

### Task 6: As telas de decisão

**Files:**
- Create: `src/app/admin/crm/[id]/perder/page.js`
- Create: `src/app/admin/crm/[id]/vender/page.js`
- Create: `src/app/admin/crm/[id]/remover/page.js`
- Create: `src/app/admin/crm/[id]/mover/page.js`
- (mais os Client Components que cada uma precisar)

Estas quatro telas substituem os `prompt()`, `confirm()` e `alert()` que existiam. **É o coração da entrega.**

- [ ] **Step 1: `perder` — o motivo**

Título "Marcar como perdido". Uma linha explicando que a oportunidade **continua na lista**, em Perdido, e pode ser reaberta — para ninguém achar que está apagando. Um `textarea` grande para o motivo (**opcional**, como hoje). Botão "Marcar como perdido"; "Cancelar" volta ao card.

`PATCH` com `{ etapa: "perdido", motivo_perda: <texto> }`. No sucesso, volta para `/admin/crm/<id>`.

- [ ] **Step 2: `vender` — registrar a venda**

Título "Registrar a venda". Mostra cliente e veículo por extenso (marca, modelo, ano, placa). Antes do botão, **o que vai acontecer**, em lista:

- o carro é marcado como **VENDIDO**;
- ele **sai do site na hora**;
- a receita **não** é lançada sozinha — faça no Financeiro, ligada ao veículo, senão a margem não sai.

Hoje esse terceiro aviso é um `alert()` que aparece **depois** de a venda estar registrada. Aqui ele aparece antes, que é quando ainda dá para agir.

Botão "Confirmar a venda" → `PATCH` com `{ action: "registrar-venda" }`. No sucesso volta ao card, que já mostrará o estado novo.

Se a oportunidade não tiver veículo ligado, esta tela **não deve ser alcançável** — mas alguém pode digitar a URL. Nesse caso, mostre uma frase explicando que não há veículo ligado e um link para editar, em vez de um botão que falha.

- [ ] **Step 3: `remover`**

Título "Remover a oportunidade". Diz que ela some **de vez**, que isso **não** mexe no veículo nem em nada do financeiro, e sugere "Marcar como perdido" (com link) para quem só quer tirar do funil sem perder o histórico. Botão de confirmar em `btnDanger`. `DELETE`, e no sucesso volta para `/admin/crm`.

- [ ] **Step 4: `mover` — qualquer etapa**

As seis etapas de `ETAPAS_INFO` como botões de largura total. A atual aparece marcada e **desabilitada**. Escolher `perdido` **redireciona para `/perder`** em vez de gravar — o motivo faz parte de perder. As demais fazem `PATCH` com a etapa e voltam ao card.

- [ ] **Step 5: A varredura final da regra**

Rode `grep -rn "alert(\|confirm(\|prompt(" src/app/admin/crm` e cole o resultado no relatório. **Tem que vir vazio.** Se sobrou algum, é defeito seu.

Liste também cada clicável das quatro telas com a altura garantida.

- [ ] **Step 6: Rodar, buildar e commitar**

```bash
npm test && npm run build
git add src/app/admin/crm
git commit -m "feat: CRM — telas de perder, vender, remover e mover no lugar dos popups"
```

---

## Depois das tasks (com o controlador)

1. Revisão final da branch.
2. Navegador em **largura de celular** (390px), com oportunidades em várias etapas: percorrer o funil inteiro, perder com motivo, reabrir, registrar venda, remover. Medir a altura de cada alvo clicável.
3. **Entrar como secretaria** e confirmar que ela cria, move e edita — é o bug que esta entrega corrige.
4. Conferir que `grep -rn "alert(\|confirm(\|prompt(" src/app/admin/crm` volta vazio.
5. Deploy: `db/crm-schema.sql` não muda, mas rode-o assim mesmo (é idempotente) antes do build, por hábito.
