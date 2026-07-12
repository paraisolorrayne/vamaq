# ADR-001a — Análise do export Finance AI (`chat-finances-ai`)

**Anexo do** [ADR-001](./ADR-001-integracao-finance-ai-crm.md) · **Data da análise:** 2026-07-11
**Fonte:** https://github.com/paraisolorrayne/chat-finances-ai (commit `46af454`, "Initial commit from remix"),
clonado como repo de referência em `../chat-finances-ai` (irmão deste repo — não é integrado, é consulta).

## 1. O que o export é

Não é um CRUD Lovable simples: é um **SaaS financeiro multi-tenant completo** (multi-CNPJ até 6
empresas por usuário, finanças PF do sócio, agentes de IA com aprovação humana, API pública,
WhatsApp, Open Finance). Stack: React 18 + Vite + react-router + shadcn/radix + tanstack-query +
supabase-js; 79 migrations; 30 edge functions (Deno); 1 worker Node próprio (`nfse-worker`,
Railway) que emite NFS-e Nacional direto no SEFIN.

**Implicação central para a Vamaq:** o produto cobre muito mais do que a concessionária precisa.
O porte deve ser **seletivo** (seção 6) — portar o núcleo financeiro e deixar fora (ou para
depois) os universos que não têm demanda confirmada.

## 2. Banco de dados (estado final das 79 migrations)

### 2.1 Dois universos + ponte

- **PJ (tenant = `companies`, isolamento por `company_id`)**: núcleo do produto. Acesso modelado
  por `company_members` (N:N usuário↔empresa, `role` admin/member/viewer, `approval_limit`).
- **PF (tenant = usuário, isolamento por `user_id`)**: 14 tabelas `personal_*` de finanças
  pessoais do sócio + espelhos Asaas PF.
- **Ponte**: `owner_transactions` (retirada, aporte, pró-labore, dividendo, mútuo) liga PF↔PJ com
  validação cruzada de propriedade.

### 2.2 Grupos de tabelas PJ

| Grupo | Tabelas | Nota |
|---|---|---|
| Núcleo | `companies`, `company_members`, `chart_of_accounts` (hierárquico, `group_code` p/ consolidação), `cost_centers`, `bank_accounts`, `transactions` | `transactions` tem dedup `UNIQUE(company_id, source, external_id)`, campos Reforma (`cbs_valor`/`ibs_valor`/`cclasstrib`) e `is_intercompany` |
| Contabilidade | `company_journal_entries` (PJ), `journal_entries` (PF) | Partidas dobradas geradas por trigger em INSERT/UPDATE/DELETE |
| Comercial/estoque | `contacts`, `products`, `sales_orders(+items)`, `purchase_orders(+items)`, `warehouses`, `stock_movements` | "Estoque financeiro" do módulo |
| Fiscal | `invoices`, `tax_guides`, `bills_payable` (workflow de alçada/aprovação), `fiscal_files`, `nfse_config` (cert PFX!), `plugnotas_config`, `plugnotas_documents` | Trigger cria guia de imposto ao autorizar NF |
| Bancário | `inter_config` (mTLS Banco Inter), `bank_connections`, `bank_transactions_raw` (staging Open Finance), 8 tabelas `company_asaas_*` | Espelhos ricos da API Asaas em jsonb |
| WhatsApp/IA/gestão | `whatsapp_configs`, `whatsapp_messages`, `whatsapp_pending_actions`, `webhooks`, `webhook_logs`, `agent_actions` (fila human-in-the-loop), `monthly_close`, `budgets`, `api_keys`, `reconciliation_log` | `agent_actions` é a filosofia do produto: agente propõe, humano aprova |
| Views | `v_company_margin(_full)`, `v_group_account_totals`, `v_group_ap_ar` | Todas `security_invoker` (dependem de RLS) |

Sem enums nativos — tudo `text + CHECK` (atenção: PF usa `receita/despesa` em pt, PJ usa
`revenue/expense` em en).

### 2.3 Funções e triggers relevantes

- `is_company_member(company_id)` — núcleo do RLS PJ (usa `auth.uid()`).
- `create_company_for_user(...)` — SECURITY DEFINER, único caminho de INSERT em
  `company_members` (anti-escalada de privilégio); limita 6 CNPJs/usuário.
- `seed_default_accounts()` — ⚠️ **bug latente**: dois triggers coexistem em `companies`
  (`on_company_created` e `trg_seed_default_accounts`) executando o mesmo seed — risco de
  double-seed; consolidar na migração.
- `auto_journal_entry_pj/pf()`, `update_personal_account_balance()`,
  `auto_tax_guide_from_invoice()`, `reserve_next_dps_number()` (incremento atômico do nº da DPS).

### 2.4 RLS → mapa de permissões do middleware

Regras consolidadas (viram checagens na camada de API do Next):

1. Dado com `company_id` → usuário precisa ser membro da empresa (`company_members`).
   `transactions` INSERT exige também `user_id` = usuário logado. Itens filhos
   (`*_order_items`) herdam do pedido pai.
2. Dado com `user_id` (PF) → só o próprio usuário. `personal_categories/rules` permitem leitura
   de registros de sistema (`user_id IS NULL`).
3. `owner_transactions` → exige as duas condições + conta PF do usuário + conta PJ da empresa.
4. `company_members` → criação nunca por insert direto (só fluxo controlado); update self-only
   sem alterar `role`.
5. `whatsapp_pending_actions`, `reconciliation_log` (escrita) → só backend (service role).

### 2.5 Dependências de Supabase no schema (adaptar p/ Postgres puro)

| Dependência | Substituição no porte |
|---|---|
| `auth.uid()` em policies/funções | Sessão da aplicação (checagem no middleware/repositories; se mantivermos RLS, `current_setting('app.user_id')`) |
| FKs para `auth.users` (9 tabelas; outras 14 usam `user_id` **sem FK** — inconsistência) | Tabela `users` própria + recriar FKs em todas |
| Bucket `storage.buckets/objects` (`documents`) | Disco da VPS (padrão já usado no site p/ fotos) ou S3/MinIO + rota de URL assinada |
| Publication `supabase_realtime` (~10 tabelas) | Polling do React Query ou SSE próprio (front usa realtime em só 5 pontos, via 1 wrapper) |
| Roles `authenticated`/`service_role`, `NOTIFY pgrst` | Remover; autorização vira middleware |
| Extensões | Só `pgcrypto` (`gen_random_bytes`) — já usada no schema da Vamaq. Sem pg_cron/pg_net |

## 3. Frontend (dimensionamento do refactor)

- **~50 rotas** react-router; centrais: `/dashboard`, `/transactions`, `/cfo-digital`, `/dre`,
  `/reports`, `/agents`, `/fiscal/contas-a-pagar`, `/close` + bloco `/settings/*` (13 páginas).
- **~200 chamadas `supabase.from()` em 59 arquivos sobre ~40 tabelas** — o grosso do trabalho.
  Camada de dados é **híbrida**: 17 hooks bem estruturados (tanstack-query, ponto de corte fácil)
  mas ~31 páginas chamam supabase direto (refactor um a um).
- **Auth concentrada** (`useAuth` + `LoginSignupForm`, 10 usos `supabase.auth.*`) — esforço baixo.
- **Storage mínimo** (1 bucket, 2 arquivos). **Realtime**: 5 pontos via 1 wrapper
  (`useRealtimeInvalidation`) — trocar por polling é trivial.
- **Edge functions chamadas do front**: 22 `functions.invoke` + fetches crus (IA streaming,
  OCR) — cada uma vira Route Handler Next.
- **IA**: toda server-side via **Lovable AI Gateway** (modelos Gemini, contrato
  OpenAI-compatible). `cfo-digital` usa streaming SSE — manter o contrato de stream no porte
  minimiza mudança no front. Gateway do Lovable **não estará disponível fora do Lovable Cloud**:
  trocar por chamada direta a um provedor (decisão: Gemini API ou Anthropic).
- `types.ts` gerado (4,6k linhas) com muitos `(supabase as any)` — tipos não confiáveis;
  regenerar do banco interno.
- Testes unitários (`src/lib/`: CSV, margem, Open Finance, PlugNotas, reforma CBS/IBS) são puros
  e **portam quase intactos**. E2E Playwright precisa reescrita pós-porte.

## 4. Integrações externas e serviços

| Serviço | Papel | Credencial | Destino no porte |
|---|---|---|---|
| Lovable AI Gateway | Toda a IA (classify, forecast, summary, CFO chat, OCR, cobrança) | `LOVABLE_API_KEY` | **Substituir** por provedor direto |
| SEFIN Nacional (gov) | Emissão NFS-e Nacional (via `nfse-worker`: assina XML DPS com cert A1, mTLS) | cert PFX + senha (DB `nfse_config`) | Worker Node roda na nossa VPS (motivo dele existir — cert não roda em Deno Deploy — desaparece); manter isolado por segurança do cert |
| PlugNotas | NFe/NFCe/MDFe (+ NFS-e fallback pago; **não emite CTe hoje**) | `api_key` por empresa (DB) | Manter se emissão de NFe for requisito |
| Asaas | Cobrança (boleto/pix/assinaturas) + webhooks | env ou DB por empresa | Confirmar se a Vamaq usa Asaas |
| Pluggy (primário) / Belvo (reserva) | Open Finance — conciliação bancária multi-banco | `PLUGGY_CLIENT_ID/SECRET` | Rota decidida no doc `OPEN-FINANCE-DECISAO.md`; respeitar limites OFB (histórico 1× no onboarding, depois incremental) |
| Banco Inter | Extrato/saldo PJ direto (mTLS, `Deno.connectTls` → reescrever com `https.Agent`) | DB `inter_config` | Só se a Vamaq tiver conta Inter |
| Evolution API | WhatsApp (lançamento por mensagem, OCR de comprovante) | `EVOLUTION_API_URL/KEY` | Opcional — decidir escopo |
| Cron (pg_cron/dashboard, **não versionado**) | `smart-alerts`, `agent-anomalies`, `agent-collections` via `CRON_SECRET` | `CRON_SECRET` | Recriar como cron do sistema na VPS chamando rotas internas |

**Segurança herdada a preservar:** cada function valida a própria auth (JWT+membership em
`_shared/auth.ts`, tokens de webhook, API key `cfk_` com hash SHA-256, cron secret) — nada confia
no gateway. No Next, `service_role` deixa de existir: rotas server-side com `pg` já têm acesso
total, então as checagens de membership do `_shared/auth.ts` viram o middleware.

**API pública v1** (`PUBLIC-API.md`): read-only por API key. Se for mantida, preservar contrato
de URL/headers/envelope.

## 5. Prazos regulatórios (relevantes — hoje é 2026-07-11)

- **03/08/2026** — NT 2025.002: DF-e sem destaque CBS/IBS passam a ser **rejeitados em produção**.
  O schema já tem os campos (`cbs_valor`, `ibs_valor`, `cclasstrib`) e `src/lib/reforma.ts` calcula.
- **01/09/2026** — NFS-e Nacional obrigatória para Simples Nacional (motivo da via própria
  `nfse-worker` ser a primária para NFS-e).

Se a Vamaq emite NF hoje por outro meio, esses prazos afetam o cronograma de go-live do módulo
fiscal — **validar com o contador** (ADR-001, passos de negócio).

## 6. Recomendação de escopo do porte (decisão pendente com a Lorrayne)

A Vamaq é **uma** concessionária (single-tenant na prática). Proposta de recorte:

**Núcleo a portar (Fase 3 do ADR-001):**
transactions + chart_of_accounts + cost_centers + bank_accounts + contacts + bills_payable +
budgets + monthly_close + invoices/tax_guides + dashboard/DRE/reports + IA de
classificação/resumo/forecast + CFO chat. Manter o motor `agent_actions` (aprovação humana).

**Portar se requisito confirmado:**
emissão NFS-e Nacional própria (nfse-worker na VPS) e/ou PlugNotas; conciliação via Pluggy;
Asaas; estoque financeiro (products/orders/stock — **atenção à sobreposição com o CRM
Automotivo**, que também tem gestão de estoque de veículos — definir dono único do estoque).

**Deixar fora (não portar agora):**
universo PF completo (14 tabelas `personal_*` + Asaas PF + `owner_transactions`), multi-CNPJ/
consolidação de grupo, WhatsApp/Evolution, API pública, Banco Inter, Belvo. Corta ~metade das
tabelas e um terço das edge functions sem perder o que o negócio pediu.

**Simplificação estrutural:** mesmo single-tenant, **manter `company_id` no schema** (custo zero,
preserva compatibilidade com o código portado e reabre multi-loja no futuro), com uma única row
em `companies` para a Vamaq.

## 7. Riscos específicos encontrados

| Risco | Ação |
|---|---|
| Double-seed: 2 triggers de seed em `companies` | Consolidar em 1 na tradução das migrations |
| `types.ts` não bate com o schema (`as any` espalhado) | Regenerar tipos do banco interno |
| Enum PF em pt vs PJ em en | Manter como está no porte (renomear = churn sem valor) |
| `.env` commitado no export | Só chaves `VITE_*` públicas; projeto Supabase de origem será abandonado — sem ação além de não repetir o padrão |
| Cron schedules não versionados | Recriar na VPS e **versionar** (docs + crontab no repo) |
| 14 tabelas PF com `user_id` sem FK | Se o universo PF ficar fora do porte, irrelevante; senão, criar FKs |

## 8. Próximos passos (ordem)

1. **Lorrayne**: validar o recorte de escopo da seção 6 (em especial: NFS-e própria vs PlugNotas,
   Pluggy/conciliação, Asaas, WhatsApp — o que a Vamaq realmente usa/contrata).
2. **Lorrayne**: export do CRM Automotivo → análise ADR-001b (decide também o dono do estoque).
3. Auth do `/admin` (pré-requisito, ADR-001 Fase 3 passo 7) — a tabela `users` própria criada aqui
   substitui o `auth.users` nas FKs do módulo.
4. Traduzir migrations do recorte para `db/` (padrão idempotente do site) + seed da company Vamaq.
5. Porte do núcleo, um grupo de telas por vez, começando por transactions/dashboard.
