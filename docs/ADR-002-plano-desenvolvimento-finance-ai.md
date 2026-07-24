# ADR-002 — Plano de desenvolvimento do Finance AI no site da Vamaq

**Status:** Proposto · **Data:** 2026-07-24 · **Branch de trabalho:** `feat/integracao-finance-ai-crm`
**Decide:** Lorrayne · **Supersede:** a decisão de stack de 2026-07-12 (porte mantendo TypeScript +
Tailwind escopado ao `/admin`), registrada fora dos ADRs.
**Lê e consolida:** [ADR-001](./ADR-001-integracao-finance-ai-crm.md) ·
[ADR-001a](./ADR-001a-analise-finance-ai.md) · [ADR-001c](./ADR-001c-estudo-porte-finance-ai.md)

---

## 0. Verificado na VPS (recon de 2026-07-24)

Levantamento read-only via SSH (`root@185.197.194.18`, app pm2 `vamaq`). Confirma os riscos do §8
como **reais e vivos em produção**:

| Fato | Valor | Implicação |
|---|---|---|
| Hardware | 4 vCPU · 7,9 GB RAM (6,6 GB livre) · disco 63 GB livre (14% uso) | Folga p/ o `vamaq-jobs` (D5); pouca folga de CPU sob upload concorrente (R1/R5) |
| Postgres | 14.23, local (`127.0.0.1:5432`), db `vamaq`, roles `postgres`(super) + `vamaq`(comum). Só schema `public` | PR-C cria `vamaq_fin` + schema `fin`; base pronta |
| Estoque | 23 veículos, 14 publicados; **497 fotos = 100 MB** em `public/images/vehicles/`, fora do git | R4 confirmado: acervo de fotos existe **só** no disco da VPS |
| **Auth do /admin** | nginx **sem `auth_basic`**; `location /` → `proxy_pass :3000` direto. `/admin` e `/api/admin/*` **abertos na internet** | **R3 confirmado e crítico** — PR-B é urgente por si só |
| **Backup** | **nenhum** — sem crontab root, sem `pg_dump`/`rsync` agendado, nenhum dump no disco | **R2/R4 confirmados** — PR-A é o primeiro passo, sem exceção |
| Runtime | Node 20.20.2 · pm2 7.0.1 · app `vamaq` com 29 restarts | — |
| R1 (event loop) | Benchmark local: os laços por pixel de `refineEdges` **travam o event loop** (0,12 s de freeze num Mac; pior caso ~0,14 s só nessa etapa). Custo dominante é a inferência ONNX de `removeBackground` (segundos em CPU), **não medida** — precisa de janela controlada na VPS | Mecanismo de R1 **confirmado**; magnitude sob a VPS de 4 vCPU pendente de medição com upload real |

---

## 1. Contexto

O que os três ADRs anteriores estabeleceram: o Finance AI (`chat-finances-ai`) é um SaaS financeiro
multi-tenant completo (79 migrations, ~50 telas, 30 edge functions Deno, 1 worker Node) do qual a
Vamaq usa uma fração; o recorte de escopo já foi feito (001a §6), as regras de negócio já foram
extraídas no nível de reimplementação (001c §1–4) e existe uma lista de 10 correções obrigatórias
(001c §5). O que ainda não existia era um plano de desenvolvimento **ancorado no que o site da
Vamaq é hoje** — e é isso que este ADR fecha.

Estado real do codebase (levantado em 2026-07-24, na `main`):

| Dimensão | Estado |
|---|---|
| Stack | Next.js 16.2.3 (App Router) · React 19.2.4 · **JavaScript puro** · CSS Modules · `pg` direto · 8 dependências no total |
| Dados | Postgres na VPS. **Uma tabela**: `vehicles` (`db/schema.sql`, 67 linhas) |
| Escrita no estoque | `src/lib/vehicleStore.js` (add/update/delete) ← usado só por `/api/admin/vehicles*` |
| Leitura do site | `src/lib/repositories/vehicles.js` (`published = true`) ← usado por `/`, `/acervo`, `/veiculo/[slug]` |
| Cadastro de veículo | `/admin/estoque/novo` (939 linhas, client component) → `/api/admin/upload` (HEIC→sharp→remoção de fundo→webp, **síncrono, no processo web**) → `POST /api/admin/vehicles` → `revalidatePath('/')` + `revalidatePath('/acervo')` |
| Fotos | `public/images/vehicles/<uuid>.webp` — gravadas em runtime, **fora do git** (`.gitignore`), existem só no disco da VPS |
| Autenticação | **Nenhuma.** Não há `proxy.js`/`middleware.js`. `/admin` e `/api/admin/*` estão abertos |
| Testes | **Nenhum** |
| Infra | VPS única, pm2 app `vamaq` em `/var/www/vamaq`, sem staging, sem backup automático confirmado |

Duas leituras decorrem disso e mandam no plano inteiro:

1. **O cadastro de veículo é o core business e é o sistema inteiro hoje.** Todo o resto (contratos,
   criativos, FIPE) é acessório. Um bug que impeça o Mateus de subir um carro, ou que tire um carro
   do ar, custa venda no mesmo dia. O Finance AI é um módulo *novo* que não pode ganhar nenhum
   direito sobre esse caminho.
2. **A distância entre os dois codebases é maior do que "trocar supabase-js por pg".** O Finance AI
   é React 18 SPA + Vite + react-router + TanStack Query + shadcn/Radix + Tailwind + TypeScript; o
   site é RSC + App Router + CSS Modules + JS. Portar arquivo a arquivo importaria uma segunda
   arquitetura para dentro do mesmo repo.

---

## 2. Decisão

**D1 — Stack única: JavaScript puro, Next.js 16 App Router, React 19, CSS Modules.**
Nada de TypeScript, Tailwind, shadcn/Radix, TanStack Query, react-router, Vite ou Deno entra no
repo. Isso **reverte** a decisão de 2026-07-12 (manter TS + Tailwind escopado ao `/admin`).

**D2 — O Finance AI é reimplementado, não transliterado.** O que se porta é o *conhecimento*
extraído no ADR-001c (regras, fórmulas, SQL, prompts), não os arquivos. Consequência direta:
`../chat-finances-ai` continua sendo repo de **consulta**, e o front dele não é ponto de partida
de nada.

**D3 — O estoque tem um contrato blindado (§4).** `vehicles` é da aplicação de estoque; o
financeiro é um consumidor de leitura, com um único ponto de escrita autorizado e enforcement no
banco (role sem permissão de escrita), não só em convenção.

**D4 — Mesmo Postgres, schema separado.** As tabelas do Finance AI vivem em `fin.*`;
`public.vehicles` fica intocada. Role própria (`vamaq_fin`) com `SELECT` em `public.vehicles` e
nada além disso.

**D5 — Trabalho pesado sai do processo web.** IA, OCR, crons e (se houver) fiscal rodam em um
segundo processo pm2 (`vamaq-jobs`, JS puro). O processo que serve o site e o cadastro de veículo
não ganha carga de CPU nova.

**D6 — Nada toca produção antes de backup testado e auth do `/admin`.** São dois gates
bloqueantes, nessa ordem.

---

## 3. Opções consideradas

### Opção A — Porte fiel: manter TypeScript + Tailwind escopado ao `/admin` (decisão de 12/07)

| Dimensão | Avaliação |
|---|---|
| Complexidade | Média no início, **alta no regime** (duas arquiteturas no mesmo repo) |
| Custo | Menor no front (componentes shadcn vêm prontos), maior em manutenção |
| Escalabilidade | Boa para volume de telas, ruim para consistência |
| Familiaridade do time | Time = 1 pessoa + IA; dois padrões dobram o custo de contexto de cada mudança |

**Prós:** aproveita os ~50 componentes shadcn e os hooks TanStack; tipos ajudam em código
financeiro; menor esforço por tela.
**Contras:** `tsconfig` + Tailwind + Radix + TanStack = 4 sistemas paralelos aos existentes; o
`/admin` fica visualmente estranho ao resto (shadcn ≠ tokens da Vamaq) ou exige re-tematizar
Tailwind com as variáveis do site — trabalho que anula boa parte da economia; toda mudança futura
exige decidir "em qual padrão eu escrevo isto?"; `types.ts` do export tem 4,6k linhas e
`(supabase as any)` espalhado (ADR-001a §3), ou seja, os tipos herdados **não** são confiáveis e
teriam de ser regerados.

### Opção B — Reimplementação em JS puro + App Router + CSS Modules  ✅ **escolhida**

| Dimensão | Avaliação |
|---|---|
| Complexidade | Baixa por unidade, **alta em volume** (cada tela é escrita do zero) |
| Custo | Maior no front (estimativa §7), menor em manutenção e em revisão |
| Escalabilidade | Boa: RSC + `pg` é o padrão que o site já opera |
| Familiaridade do time | Máxima — é o único padrão do repo |

**Prós:** um padrão só; identidade visual da Vamaq por construção (reusa
`src/styles/variables.css`); 8 dependências continuam sendo 8; RSC elimina a camada de
data-fetching client (TanStack) e boa parte do estado; revisão de código (humana e por IA) fica
muito mais barata.
**Contras:** o front do Finance AI vira referência, não código — **é rewrite**; perde-se checagem
de tipos justamente em código financeiro (mitigação: JSDoc nas camadas de dinheiro + testes de
fórmula, §5.3); componentes de UI (modal, select, toast, tabela) passam a ser nossos, com o custo
de acessibilidade que o Radix resolvia; as libs puras testadas do Finance AI (`csv`, `margem`,
`reforma`, `openFinance`) precisam de conversão TS→JS (mecânica, mas não é zero).

### Opção C — App separado: manter o Finance AI como está, atrás de `/financeiro` via nginx

| Dimensão | Avaliação |
|---|---|
| Complexidade | Baixa agora, **muito alta depois** |
| Custo | Menor no dia 1 |
| Escalabilidade | Ruim: dois apps, dois deploys, dois modelos de auth, dois pools |
| Familiaridade | Ruim |

**Prós:** entrega rápida; isolamento total do core.
**Contras:** exige Supabase (ou reescrever a camada de dados de qualquer jeito); dois sistemas de
login; o vínculo veículo↔lançamento — que é o valor real para a concessionária (§4.5) — fica
atravessando fronteira de app; UI de outra marca dentro do domínio da Vamaq; contraria a
centralização de estoque decidida no ADR-001.

---

## 4. O contrato do core business (parte rígida)

Estas são invariantes, não recomendações. Um PR do financeiro que viole qualquer uma delas é
rejeitado, mesmo funcionando.

### 4.1 Propriedade e escrita

1. `public.vehicles` é da aplicação de estoque. **Fonte única de verdade** do veículo (ADR-001,
   decisão de escopo 4).
2. **Único caminho de escrita**: `src/lib/vehicleStore.js`. Nenhum código do financeiro emite
   `insert`/`update`/`delete` em `vehicles`, direta ou indiretamente.
3. Enforcement no banco, não na disciplina: o financeiro usa a role `vamaq_fin`
   (`DATABASE_URL_FIN`), com `GRANT SELECT ON public.vehicles` e `GRANT ALL ON SCHEMA fin`. Sem
   `INSERT/UPDATE/DELETE` em `public.*`. Se alguém escrever o código errado, o banco recusa.
4. O pool do site (`DATABASE_URL`) continua existindo e continua sendo o do estoque. São dois
   pools, dois usuários, um banco.

### 4.2 Leitura do site

5. `src/lib/repositories/vehicles.js` — o `SELECT` e o filtro `published = true` — não muda de
   comportamento. Pode ganhar colunas; não pode ganhar `join`, nem condição nova, nem dependência
   de tabela `fin.*`. O acervo público não pode ficar refém do módulo financeiro.
6. Nenhuma página pública (`/`, `/acervo`, `/veiculo/[slug]`, `/sobre`, `/contato`) importa
   qualquer coisa de `fin`, de auth ou do financeiro.
7. Se o Postgres do financeiro estiver indisponível, o site público carrega normalmente. Teste
   explícito no PR-1.

### 4.3 O caminho crítico do cadastro

8. `/admin/estoque/novo` → `/api/admin/upload` → `POST /api/admin/vehicles` → `revalidatePath('/')`
   + `revalidatePath('/acervo')`: essa sequência é congelada. Refactor dela é PR próprio, nunca
   carona num PR do financeiro.
9. **Nenhuma carga de CPU nova no processo web.** A remoção de fundo já é síncrona e roda em
   `refineEdges`/`createDropShadow` com laços por pixel (O(w·h·r²) — numa foto de 2560px são
   centenas de milhões de iterações, bloqueando o event loop). IA, OCR, cron e fiscal vão para o
   `vamaq-jobs` (D5). Risco R1 (§8) trata do que já existe.
10. `public/images/vehicles/` não é tocada, movida nem versionada por nenhum PR do financeiro.
    `next.config.mjs` não ganha `output: 'standalone'` (quebraria o serviço das fotos gravadas em
    runtime).
11. Antes e depois de todo PR do financeiro, o smoke test do §5.4 passa. É o critério de merge.

### 4.4 Ciclo de vida do veículo (o que muda no estoque — e só isso)

Único ponto em que o financeiro justifica mexer no estoque, e ainda assim de forma aditiva:

12. `vehicles` ganha `status text not null default 'disponivel'` com
    `check (status in ('disponivel','reservado','vendido','inativo'))`. Coluna aditiva: todas as
    linhas existentes nascem `disponivel`, nada muda no site.
13. `published` **continua sendo o único critério de exibição pública** neste momento. A regra
    "vendido some do site" é aplicada por *ação explícita* (`setVehicleStatus` seta
    `status='vendido'` **e** `published=false` na mesma transação e revalida os paths), não por
    filtro implícito no repositório de leitura. Mudança do filtro público só quando o CRM chegar,
    em PR próprio, com teste.
14. `deleteVehicle` (hard delete) sai da UI: vira "Desativar" (`status='inativo'`,
    `published=false`). Motivo duplo — preservar histórico (ADR-001) e evitar que o operador
    esbarre em `ON DELETE RESTRICT` depois que o veículo tiver lançamento financeiro. A função
    permanece exposta só via API para casos de cadastro errado *sem* vínculo financeiro.

### 4.5 O vínculo veículo ↔ financeiro (por que isso vale a pena)

15. `fin.transactions.vehicle_id uuid references public.vehicles(id) on delete restrict` (nulável).
    É o que entrega **margem por veículo**: custo de aquisição (conta 4.1) + despesas de preparação
    + venda ⇒ lucro real por carro, que é a pergunta que uma concessionária faz todo dia e que o
    Finance AI genérico não responde.
16. O financeiro lê veículo pela view `fin.v_vehicles` (`select` limitado sobre `public.vehicles`).
    Se o shape do estoque mudar, quebra na view — um lugar só, controlado.

---

## 5. Como o código do Finance AI atravessa para cá

### 5.1 O que porta quase intacto

| Origem | Destino | Observação |
|---|---|---|
| SQL das 79 migrations (recorte de 001a §6) | `db/fin-schema.sql` | Idempotente (`create ... if not exists`), sem `auth.*`/`storage.*`/RLS/roles Supabase |
| Triggers de partida dobrada, seed de plano de contas, `reserve_next_dps_number` | idem | Consolidar o trigger de seed duplicado (correção #8) |
| Prompts de sistema (`supabase/functions/*/index.ts`) | `src/lib/fin/ai/prompts.js` | **Verbatim**, incluindo `sanitizeForPrompt` |
| Fórmulas §1 do ADR-001c (DRE, margem, score, orçamento) | `src/lib/fin/calc/*.js` | TS→JS mecânico; ganham testes (§5.3) |

### 5.2 O que é reescrito

| Origem | Destino |
|---|---|
| ~50 rotas react-router + shadcn | ~12 rotas RSC em `/admin/financeiro/*` com CSS Modules (recorte §6) |
| 17 hooks TanStack + ~200 `supabase.from()` em 59 arquivos | Server Components lendo repositórios `src/lib/fin/repositories/*.js` + Server Actions para escrita |
| 30 edge functions Deno | ~10 Route Handlers em `/api/admin/financeiro/*` (site) e jobs em `vamaq-jobs` |
| `nfse-worker` (TS/Express) | Se e quando o PR-12 acontecer: serviço JS puro (`node:http`), processo separado por causa do certificado |
| Realtime Supabase (5 pontos) | Revalidação de rota / `router.refresh()` |
| Auth Supabase (`useAuth`, 10 usos) | Sessão em cookie httpOnly + DAL (§5.5) |

### 5.3 Sem TypeScript, o que segura o dinheiro

A perda de tipos em código financeiro é o custo real da D1. Mitigação, obrigatória nos PRs 1–6:

- **Valores monetários nunca em float.** Reusar `src/lib/money.js` (`parseValorBR`/`formatValorBR`,
  já usado pelo estoque e pelos contratos); `numeric(12,2)` sai do `pg` como string — converter
  numa fronteira só, nunca ad hoc.
- **JSDoc** (`@typedef`) nas entidades de `src/lib/fin/` — o editor dá autocomplete e o `jsconfig`
  já resolve `@/*`; sem build step.
- **Testes com `node:test`** (built-in, zero dependência nova) para: DRE, margem bruta/operacional,
  score financeiro, alçada de aprovação, dedupe de conciliação, `parseValorBR` em entrada pt-BR.
  Hoje o repo não tem teste nenhum; o financeiro é o lugar certo para o primeiro.

### 5.4 Smoke test de não-regressão do core (critério de merge, §4.3-11)

Roteiro fixo, executado em cada PR do financeiro (automatizável com `node:test` + fetch nas rotas):

1. `GET /` e `GET /acervo` respondem 200 e listam a mesma quantidade de veículos de antes.
2. `GET /veiculo/<slug conhecido>` responde 200 com a foto principal.
3. Cadastro completo: upload de foto (com e sem remoção de fundo) → salvar → o veículo aparece em
   `/acervo` **sem restart**.
4. Edição de veículo publicado → alteração visível em `/veiculo/<slug>`.
5. Despublicar → some de `/acervo`; republicar → volta.
6. Com o financeiro fora do ar (role `vamaq_fin` revogada / schema `fin` inacessível): passos 1–5
   continuam passando.

### 5.5 Auth (pré-requisito de tudo — ADR-001 Fase 3 passo 7)

Hoje `/admin` e `/api/admin/*` estão abertos: qualquer pessoa que descubra a URL pode cadastrar,
editar e **apagar** veículos do site em produção. Isso já é um problema **hoje**, independente do
Finance AI — e é o primeiro PR. *(A verificar na VPS: se há `basic auth` no nginx à frente do
`/admin`, o risco imediato é menor, mas o plano não muda.)*

Padrão Next 16 (validado em `node_modules/next/dist/docs/01-app/02-guides/authentication.md`):

- `src/proxy.js` — **em Next 16 `middleware` chama-se `proxy`** — só para checagem otimista de
  cookie, `matcher: ['/admin/:path*', '/api/admin/:path*']`. Rota pública nunca entra no matcher.
- **DAL** (`src/lib/auth/dal.js`, com `import 'server-only'` e `verifySession()` memoizado via
  `cache()` do React): a autorização de verdade fica junto do dado, chamada em cada Route Handler
  e Server Action. O proxy não é linha de defesa (a própria doc diz isso).
- Tabelas `public.users` + `public.sessions` (schema `public`, porque servem o admin inteiro, não
  só o financeiro). Papéis do ADR-001: `admin`, `financeiro`, `vendedor`. `approval_limit` mora em
  `fin.company_members` (é conceito do financeiro), chega no PR-6.

---

## 6. Recorte de escopo (o que será construído)

Confirma 001a §6 e aperta: **~12 telas**, não ~50.

> **Decisão 2026-07-24 (Lorrayne): a IA fica desativada por enquanto.** Todo o valor da
> concessionária — lançamentos, DRE, relatórios e **margem por veículo** — não depende de IA. A
> Trilha 2 inteira (§7) sai do escopo ativo até haver decisão de ligar; nenhum PR do núcleo
> (A→6) tem dependência de provedor de IA, então a §9-5 deixa de ser bloqueante. Consequência
> concreta no núcleo: **PR-7 (classificação por IA) não entra** e, no form de lançamento, a
> conta/centro de custo é escolha manual (o campo já é obrigatório só no client — 001c §1). O
> motor `agent_actions` fica na Trilha 2, pois seus produtores (anomalias, cobrança) são de IA.

**Entra (núcleo, sem IA):** lançamentos (classificação manual) · plano de contas · centros de
custo · contas bancárias · contatos · dashboard · DRE · relatórios · **ficha financeira do veículo
(margem por carro)** · contas a pagar com alçada · fechamento mensal · orçamento.

**Adiado — Trilha 2 (IA), desativado por decisão:** classificação por IA · CFO Digital · resumo
executivo · forecast · OCR de comprovante · motor `agent_actions` + agentes de anomalia/cobrança ·
WhatsApp (Avisa). Retomável a qualquer momento sem tocar no núcleo.

**Condicional a decisão de negócio:** fiscal NFS-e/NF-e · conciliação bancária (Pluggy ou import
de extrato) · Asaas.

**Fora:** universo PF (14 tabelas `personal_*`, `owner_transactions`) · multi-CNPJ e consolidação
de grupo · API pública v1 · Banco Inter · Belvo · Evolution API. Mantém-se `company_id` no schema
com uma única row em `companies` (ADR-001, decisão 1).

---

## 7. Plano de desenvolvimento (sequência de PRs)

Substitui a tabela de §6 do ADR-001c. Cada PR compila, roda e é validável sozinho. "Risco ao core"
é o quanto o PR chega perto do caminho crítico do §4.3.

### Trilha 0 — Blindagem (bloqueante; nada do financeiro começa antes)

| PR | Escopo | Depende | Risco ao core | Ordem de grandeza |
|---|---|---|---|---|
| **A** | `pg_dump` diário + `rsync` de `public/images/vehicles/` para fora da VPS; **restore ensaiado** uma vez, documentado em `docs/RUNBOOK-BACKUP.md`. Sem isso, nenhuma migration roda em produção | — | nenhum | ~0,5 dia |
| **B** | Auth do `/admin`: `users`/`sessions`, login, `src/proxy.js` (matcher só `/admin*` e `/api/admin*`), DAL com `verifySession()`, papéis. Fecha o buraco de escrita aberta | A | **alto** (mexe no acesso ao admin) — smoke test §5.4 obrigatório | ~2–3 dias |
| **C** | Contrato do estoque: `status` aditivo (§4.4-12), `setVehicleStatus`, "Excluir"→"Desativar", role `vamaq_fin` + `DATABASE_URL_FIN`, view `fin.v_vehicles`, **primeiro teste automatizado do repo** = smoke test §5.4 | B | médio | ~1,5–2 dias |

### Trilha 1 — Núcleo financeiro

| PR | Escopo | Depende | Risco ao core | Ordem de grandeza |
|---|---|---|---|---|
| **1** | `db/fin-schema.sql`: `companies`, `company_members`, `chart_of_accounts`, `cost_centers`, `bank_accounts`, `contacts`, `transactions` (+`vehicle_id`), journal + triggers, views de margem. Seed da Vamaq com **plano de contas de concessionária** (4.1 = Custo de Aquisição de Veículos, 4.2 = Preparação/Reparos, 5.2 = Comercial…). Teste: site sobe com `fin` inacessível (§4.2-7) | C | baixo | ~2 dias |
| **2** | Repositórios `src/lib/fin/repositories/*` + Route Handlers `/api/admin/financeiro/*` com autorização por papel. Regras do 001c §1: `pending/confirmed/reconciled`, editabilidade por `source`, dedupe `external_id` | 1 | baixo | ~3 dias |
| **3** | UI de Lançamentos (lista paginada 25 + busca, form, edição) em `/admin/financeiro/lancamentos` — RSC + Server Actions + **kit de UI interno** em CSS Modules (~12 componentes sobre `variables.css`) | 2 | baixo | ~3–4 dias |
| **4** | Dashboard + DRE + Relatórios (fórmulas 001c §1, score determinístico) | 2 | baixo | ~4 dias |
| **5** | **Ficha financeira do veículo**: lançamentos vinculados a `vehicle_id`, custo total, margem por carro, atalho a partir de `/admin/estoque`. *Aqui o financeiro paga o core business* | 3,4 | médio (lê estoque; nunca escreve) | ~2–3 dias |
| **6** | Contas a pagar com alçada **server-side** (correção #1) + fechamento mensal (checklist + classificação **manual** em lote — sem IA) | 3 | baixo | ~3 dias |

### Trilha 2 — Inteligência ⏸️ **desativada por decisão (2026-07-24, §6)**

Nada aqui está no escopo ativo. Fica documentado para retomada futura; nenhum PR do núcleo (A→6)
depende desta trilha, e o provedor de IA (§9-5) só volta a ser questão quando ela for reativada.

| PR | Escopo | Depende | Observação |
|---|---|---|---|
| **7** | Adapter de provedor de IA (frame SSE OpenAI preservado) + `ai-classify` no form, com correções #2 (validar UUIDs) e #3 (regex `/\{[\s\S]*\}/`) | 3 | decisão pendente: Gemini direto ou Anthropic (§9) |
| **8** | CFO Digital (chat streaming) + resumo executivo, com `buildFinancialContext` unificado (correção #4) | 7 | KPIs calculados em JS antes do prompt |
| **9** | Processo `vamaq-jobs` (pm2, JS puro) + motor `agent_actions` + agente de anomalias + cron com `CRON_SECRET` **versionado** | 6,7 | primeiro PR que cria processo novo (D5) |
| **10** | OCR de documento (scanner → contato/conta a pagar/guia) | 7,9 | roda no `vamaq-jobs` |
| **11** | Adapter WhatsApp **Avisa API** (`sendText`/`getMedia`/normalizador inbound) + alertas com destinatário explícito (correção #9) | 8,9 | "foto de comprovante vira lançamento" é **construção nova**, não porte (001c §2) |

### Trilha 3 — Condicionais (só com decisão de negócio na mão)

| PR | Escopo | Gatilho |
|---|---|---|
| **12** | Fiscal: worker JS isolado + emissão + gaps 001c §4 (cifrar certificado, persistir XML, idempotência, cancelamento) | Resposta do contador: NF-e de venda? NFS-e de comissão? nenhuma? |
| **13** | Conciliação bancária + tela de pendências | Banco da Vamaq definido; Pluggy vs import manual |

**Caminho mínimo até valor real (A → 6):** ordem de grandeza de **20–25 dias de desenvolvimento** —
e, com a IA fora, é também o **escopo entregável completo** por enquanto. A Trilha 2 (~13–15 dias)
está adiada por decisão. É estimativa de esforço, não cronograma.

---

## 8. Riscos e mitigações

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| R1 | Remoção de fundo bloqueia o event loop do processo web (já hoje): durante um upload, o site público fica lento/parado | Alta | **Medir** antes de qualquer coisa (tempo de resposta de `/acervo` durante um upload). Se confirmado, mover para `vamaq-jobs` em PR próprio, fora do escopo do financeiro (§4.3-8) |
| R2 | VPS única sem staging: migration errada derruba o site | Alta | PR-A bloqueante; migrations aditivas e idempotentes; ensaio em restore local do dump de produção antes de aplicar |
| R3 | `/admin` aberto em produção hoje | Alta | PR-B é o segundo passo, antes de qualquer dado financeiro |
| R4 | Fotos existem só no disco da VPS (fora do git) | Alta | `rsync` no PR-A; nunca mudar `output` do Next (§4.3-10) |
| R5 | Contenção de CPU/RAM entre site, IA e crons na mesma VPS | Média | D5 (processo separado) + `nproc`/`free -m` antes do PR-9 + limites no pm2 |
| R6 | Perda de tipos em cálculo financeiro (custo da D1) | Média | §5.3 (JSDoc + `node:test` nas fórmulas + `money.js` como fronteira única) |
| R7 | Escopo do financeiro inflar de volta para as ~50 telas | Média | §6 é o recorte; tela nova exige emenda a este ADR |
| R8 | Componentes de UI próprios com acessibilidade pior que o Radix | Baixa | Preferir primitivas nativas (`<dialog>`, `<select>`, `<details>`); foco/teclado no checklist de revisão do kit (PR-3) |
| R9 | A branch `feat/integracao-finance-ai-crm` está **11 commits atrás da `main`** | Baixa | Rebase antes do primeiro PR de código (ação 1, §10) |
| R10 | Prazos fiscais (03/08/2026 CBS/IBS; 01/09/2026 NFS-e Simples) empurrarem o PR-12 para a frente da fila | Média | Depende da resposta do contador (§9-2). Se a Vamaq não emite nada hoje, não há prazo a cumprir — confirmar por escrito |

---

## 9. Perguntas em aberto (negócio — herdadas do 001c §7)

1. A Vamaq é Simples Nacional?
2. O que o contador diz que a Vamaq precisa emitir — NF-e de venda de veículo, NFS-e de comissão de
   consignação, ambas, nenhuma? *(define PR-12 e R10)*
3. Asaas: usa/quer? *(define agent-collections)*
4. Conciliação: qual banco? Pluggy ou import manual de extrato? *(define PR-13)*
5. ~~Provedor de IA: Gemini direto ou Anthropic?~~ **Resolvido (2026-07-24): IA desativada por
   enquanto (§6).** Volta a ser questão só quando a Trilha 2 for reativada.
6. WhatsApp → lançamento por foto de comprovante é requisito? *(é construção nova)*
7. Quem são os usuários do admin e com que papel? *(entra no PR-B)*

---

## 10. Próximas ações

| # | Ação | Dono | Status |
|---|---|---|---|
| 1 | Rebase de `feat/integracao-finance-ai-crm` sobre a `main` (11 commits) | Claude Code | ✅ feito |
| 2 | Verificar na VPS: `nproc`, `free -m`, basic auth no nginx, backup existente | Claude Code | ✅ feito — ver §0 (sem auth, sem backup) |
| 3 | Medir R1 (latência do site durante upload com remoção de fundo) | Claude Code | ⏳ mecanismo confirmado (§0); magnitude na VPS pede janela controlada |
| 4 | Validar §2 (D1–D6), §4 (contrato do core) e §6 (recorte) | Lorrayne | **decisão pendente** |
| 5 | ~~Responder §9-5 (provedor de IA)~~ — **resolvido: IA desativada (§6)** | Lorrayne | ✅ decidido |
| 5b | Escolher destino de backup externo (Backblaze B2 / Wasabi / outra VPS / Drive) — destrava o PR-A | Lorrayne | **pendente** |
| 6 | Levar §9-1/2 ao contador da Vamaq | Lorrayne | pendente |
| 7 | Executar PR-A → PR-B → PR-C | Claude Code | após ação 4 |
| 8 | ADR-001b (CRM) segue pendente do export; este ADR não depende dele, mas o filtro público do §4.4-13 sim | Lorrayne | pendente |
