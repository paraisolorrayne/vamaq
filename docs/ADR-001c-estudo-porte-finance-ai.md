# ADR-001c — Estudo do código Finance AI + plano de porte

**Anexo do** [ADR-001](./ADR-001-integracao-finance-ai-crm.md) · **Data:** 2026-07-12
Aprofunda o [ADR-001a](./ADR-001a-analise-finance-ai.md) (mapeamento) com as **regras de negócio no
nível de reimplementação**, extraídas por leitura dirigida de 4 frentes: núcleo financeiro,
workflow/agentes, camada de IA e fluxo fiscal. Fecha com correções obrigatórias e o plano de porte
em passos de tamanho de PR.

## 1. Núcleo financeiro — regras essenciais

### Lançamentos (`transactions`)
- **Status**: `pending` (fora dos números; pendência de fechamento) → `confirmed` (entra em tudo;
  criação manual pela UI já nasce `confirmed`) → `reconciled` (casado com integração; também entra
  nos números). Idempotência de integrações: `UNIQUE(external_id) WHERE NOT NULL`.
- **`source` decide editabilidade**: `asaas|bank` não deletam e só editam classificação
  (conta/CC/banco); `manual|whatsapp` edição total.
- Obrigatoriedade de `account_id`/`cost_center_id` é **só client-side** — o banco aceita NULL
  (importações geram lançamentos sem conta; o fechamento os lista).
- **Classificação por IA**: no form, debounce 600ms sobre a descrição (≥5 chars); só aplica se o
  usuário ainda não escolheu conta; `confidence` é ignorado. No fechamento mensal, lote de até 20
  sem conta é classificado e **aplicado automático** (sem confirmação).

### Conciliação (`reconcile-transactions`)
- Match: mesmo tipo, data ±2 dias, valor ±5%; descrição NÃO participa. Quando transação de API
  casa com manual/whatsapp, a **manual vence** (vira `reconciled` e ganha o `external_id`); a da
  API não é inserida. `resolve confirm` (decisão humana) hard-deleta a duplicata com snapshot em
  `reconciliation_log`. Ações `list_pending`/`resolve` existem no backend **sem UI** (decidir:
  construir tela ou cortar). Só o Banco Inter chama conciliação hoje; Asaas não.

### DRE / margem (fórmulas)
- Convenção por prefixo do código da conta: receitas = `type='revenue'` (contas 3.x); **custos
  (CMV) = expense com código iniciando em `4`**; despesas operacionais = expense com o restante
  (5.x). Conta sem código cai em "despesas".
- `Lucro Bruto = receita − custos`; `Lucro Líquido = lucro bruto − despesas`;
  `Margem Bruta % = (receita−custos)/receita`; `Margem Operacional % = resultado/receita`.
  Tudo filtrando `status='confirmed'`. Views `v_company_margin` (exclui intercompany — irrelevante
  single-tenant) e `v_company_margin_full` (usada como "realizado" no orçamento).
- **Score financeiro** (determinístico): base 50, ±pontos por margem (>30% +20 … ≤0 −15),
  crescimento de receita (+15/+5/−10) e de despesa (+10/−10), clamp 0–100; níveis
  Excelente/Bom/Regular/Atenção/Crítico.

### Partidas dobradas (`auto_journal_entry_pj`)
Trigger em `transactions` (INSERT/UPDATE/DELETE): expense → débito `Despesas:{conta}`, crédito
`Ativo:{banco|Caixa}`; revenue → débito `Ativo:{banco}`, crédito `Receitas:{conta}`. 1 par por
lançamento, valor cheio, contas como strings hierárquicas (não FK). UPDATE recria o par.

### Fechamento mensal (`monthly_close`)
Marco gerencial **soft**: não trava lançamentos retroativos. Checklist com contagens (sem conta,
pendentes, cobranças Asaas vencidas), snapshot jsonb dessas contagens, pode fechar com pendências;
reabrir só volta o status.

### Orçamento (`budgets`)
Grade anual receita/custos/despesas por mês; realizado da `v_company_margin_full`; desvio neutro
se |Δ|<5%; receita acima do orçado = verde, custos/despesas abaixo = verde.

### Plano de contas padrão (seed, `editable=false`)
3.1–3.4 Receitas (Serviços/Produtos/Recorrente/Outras) · 4.1–4.5 Custos (CMV, CSP, MO direta,
taxas de pagamento, fretes) · 5.1.x Adm (pró-labore, salários, contabilidade, jurídico, aluguel,
energia/internet, softwares) · 5.2.x Comercial (marketing, tráfego pago, comissão) · 5.3.x
Financeiras (juros, tarifas) · 5.4.x Impostos. Centros de custo: Administrativo, Financeiro,
Comercial, Marketing, Operacional, Instalação. **Adaptar nomenclatura à concessionária no seed da
Vamaq** (ex.: 4.1 vira "Custo de Aquisição de Veículos").

## 2. Workflow e agentes — regras essenciais

### Contas a pagar com alçada (`bills_payable` + `company_members.approval_limit`)
- Dois eixos independentes: `status` (pago/a_vencer/vencido — **computado no client**) e
  `approval_status` (draft/awaiting_approval/approved/rejected; `draft` e o `scheduled` do
  comentário são estados mortos).
- Criação: valor > alçada do criador → `awaiting_approval`; senão `approved`. `approval_limit`
  NULL = ilimitado. Aprovador também precisa de alçada suficiente; transição protegida por guarda
  otimista (`eq approval_status='awaiting_approval'`).
- **Aprovar não executa nada** (só libera "Marcar como Pago"); pagar **não gera lançamento** em
  `transactions` — contas a pagar é uma ilha. Sem notificações.
- ⚠️ **Alçada é imposta só no hook React** — mover para a camada de API no porte (item 6.1).

### Motor `agent_actions` (human-in-the-loop — filosofia do produto)
- Fila `pending → approved|rejected → executed`; dedupe por índice **parcial único**
  `(dedupe_key) WHERE status='pending'` (race-safe; chave pode reaparecer após decisão).
- Aprovar **nunca executa automático**: cobrança aprovada vira link `wa.me` que o operador clica
  (dispara `executed`); anomalia aprovada é só flag de revisão. `failed`/`expired` existem no
  CHECK mas nenhum código os seta; agente `close` está no enum sem produtor.
- **agent-anomalies** (cron): recentes = 7 dias, `amount ≥ 500`; baseline = 90 dias anteriores por
  `account_id` (fallback `type`), mínimo 5 amostras; anomalia se `valor > 3× média`. Grava
  `agent='alerts'` (mismatch de nome).
- **agent-collections** (cron + botão): fonte = espelho Asaas (`company_asaas_payments`
  PENDING/OVERDUE, vencimento ≤ hoje+3d); IA rascunha mensagem (≤3 frases, com fallback
  determinístico se a IA falhar); humano envia.
- **smart-alerts** (cron): **não usa IA** — thresholds fixos (despesa >1.3× mês anterior, receita
  <0.8×, prejuízo, gasto unitário >30% da receita), envia WhatsApp e **não persiste nada**;
  destinatário = último telefone inbound (frágil — no porte, telefone do admin explícito).
- ⚠️ **Pipeline "WhatsApp → lançamento" NÃO está implementado**: `whatsapp_pending_actions`
  (confirmação com expiração de 10 min) existe só como tabela; o webhook atual é um CFO de
  perguntas-e-respostas + comandos `ações`/`aprovar N`. Se a Vamaq quiser lançar despesa mandando
  foto de comprovante no WhatsApp, será **construído** (reusando `ocr-document`, que já faz a
  extração+classificação e valida IDs contra o banco).

### Acoplamento WhatsApp (Evolution → Avisa)
Toda a superfície Evolution está em 3 pontos: `sendText`, `getBase64FromMediaMessage` e o shape do
webhook inbound (`data.key.*`, `data.message.*`). Adapter a criar:
`sendText(to, text)` + `getMedia(messageId)` + normalizador de evento inbound + verificação de
secret — Avisa implementa essa interface; o resto do código não muda.

## 3. Camada de IA — contratos

| Rota | Modelo (hoje) | Stream | Entrada | Saída |
|---|---|---|---|---|
| cfo-digital | gemini-3-flash-preview | SSE | `{messages[]\|question}` | delta OpenAI |
| ai-classify | gemini-2.5-flash-lite | não | `{description, type}` | `{account_id, cost_center_id, confidence}` |
| ai-summary | gemini-2.5-flash | SSE | — | markdown 6 seções fixas |
| ai-forecast | gemini-2.5-flash | não | — | `{forecast[3 meses], insights, risk_level, history}` |
| ocr-document | gemini-2.5-flash ×2 | não | `{image_base64, mimetype}` | extração + `suggested_*_id` validados |

- **Nenhuma função usa tool calling** — todas pedem JSON no prompt. Trocar o Lovable AI Gateway é
  trocar endpoint/chave/modelo, desde que a rota reemita o **frame SSE OpenAI**
  (`data: {choices:[{delta:{content}}]}` + `[DONE]`) que está hardcoded em 4 componentes do front.
- Contexto do CFO: 1000 transações + plano de contas + CCs + bancos + extrato 30, com KPIs
  **calculados em JS antes do prompt** (o modelo não faz aritmética crítica). Memória de conversa é
  client-side (stateless no server). `buildFinancialContext` está **duplicado** entre `cfo-digital`
  e `whatsapp-webhook` — unificar no porte.
- Projeção do forecast é **100% IA** (sem modelo estatístico); simulador idem. Se quiser
  determinismo, é feature nova.
- Prompts de sistema completos estão nos fontes (`supabase/functions/*/index.ts`) — portar
  verbatim; incluem `sanitizeForPrompt` (anti prompt-injection) a preservar.
- Provedor destino: decisão pendente (Gemini API direto ou Anthropic). Volume/latência favorecem
  modelo rápido/barato para classify/OCR e um mais capaz para o CFO chat.

## 4. Fiscal NFS-e Nacional — o que vale e o que falta

**Caminho de produção real**: `NfseEmit.tsx → nfse-proxy → nfse-worker → SEFIN`
(`POST /SefinNacional/nfse`, XML DPS assinado RSA-SHA256/C14N, GZip+B64, mTLS com A1).
A edge `nfse-operations` **não emite** (stub legado — só o parse do certificado é usado).
Numeração DPS com reserva atômica (`reserve_next_dps_number`).

**Gaps a fechar antes de produção** (a implementação de referência completa existe no
`nfse-nacional-mcp` — portar de lá):
1. Cancelamento é stub 501 (referência: evento `e101101`, prazo 35 dias).
2. Consulta de nota por chave / DANFSE (PDF) não expostos na via de produção.
3. **XML DPS assinado não é persistido** (guarda fiscal) — `invoices.xml_content` grava o JSON de
   resposta; `contact_id` fica null; `number` recebe o idDPS.
4. **Certificado e senha em claro no banco** (regra documentada e não cumprida) — cifrar com
   pgcrypto no porte.
5. Sem idempotência/retry no worker (retry pós-timeout pode duplicar nota; cache por idDPS existe
   só no MCP).
6. `optanteSimplesNacional` hardcoded `false` — ler de `companies.regime_tributario`.
7. Guia de ISS gerada por trigger é **estimativa grosseira** (5% flat, vencimento dia 15 fixo) —
   parametrizar alíquota/vencimento reais do município.
8. Dropdown de códigos de serviço é hardcoded de TI — trocar pela lista LC 116 do ramo.

**Reforma Tributária**: o DPS próprio **não** destaca CBS/IBS (a base `reforma.ts` + colunas
existem, falta o grupo no XML). Para **Simples Nacional o destaque só vale a partir de 2027**,
então o prazo de 03/08/2026 não bloqueia a Vamaq se ela for do Simples — mas o mapper
`gIBSCBS` entra no backlog de 2026H2.

**Custo de ativação da via própria**: certificado A1 (~R$120–250/ano, único custo recorrente;
zero custo por nota) + credenciamento no Emissor Nacional (município precisa estar conveniado —
Uberlândia: verificar) + inscrição municipal + homologar em `producaorestrita` antes de virar
produção.

**⚠️ Ponto de negócio para o contador:** concessionária **vende mercadoria** (veículo) —
isso é **NF-e (produto), não NFS-e**. A NFS-e da Vamaq se aplicaria a **serviços** — ex.: comissão
de intermediação na consignação. No Finance AI, NF-e só existe pela via PlugNotas (paga). Definir
com o contador o que a Vamaq de fato precisa emitir (NF-e de venda? NFS-e de comissão? nenhuma?)
antes de investir na ativação de qualquer via.

## 5. Correções obrigatórias no porte (consolidado dos 4 estudos)

| # | Correção | Origem |
|---|---|---|
| 1 | Alçada de aprovação: impor na camada de API/banco, não só no hook | §2 |
| 2 | Validar UUIDs retornados pelo `ai-classify` contra o banco (como o ocr já faz) | §3 |
| 3 | Regex de JSON do ai-classify (`/\{[^}]+\}/`) quebra com objeto aninhado → `/\{[\s\S]*\}/` | §3 |
| 4 | Unificar `buildFinancialContext` (duplicado cfo-digital × whatsapp) | §3 |
| 5 | Cifrar `cert_pfx_base64`/`cert_password` (pgcrypto) | §4 |
| 6 | Persistir XML DPS assinado + `contact_id` na `invoices` | §4 |
| 7 | Idempotência + retry (1s/3s/9s, só 5xx) no worker NFS-e | §4 |
| 8 | Consolidar trigger de seed duplicado em `companies` (double-seed) | ADR-001a |
| 9 | Destinatário explícito para alertas WhatsApp (não "último inbound") | §2 |
| 10 | Membership/autorização nas rotas fiscais (hoje só validam JWT) | §4 |

## 6. Plano de porte em passos de PR (ordem proposta)

Cada passo compila, roda e é validável isoladamente. Pré-requisito de tudo: **PR-0 (auth)**.

| PR | Escopo | Depende de |
|---|---|---|
| 0 | Auth do /admin: tabela `users` + `company_members` (papéis/alçada), sessão cookie httpOnly, middleware, telas de login/usuários | — |
| 1 | Schema financeiro núcleo em `db/` (transactions, chart_of_accounts, cost_centers, bank_accounts, contacts, journal + triggers, views de margem) + seed Vamaq (company única, plano de contas adaptado a concessionária) | 0 |
| 2 | Camada de repositórios `pg` + rotas API internas (CRUD lançamentos, contas, CCs) com autorização | 1 |
| 3 | Telas: Lançamentos (lista/form/edição, paginação 25, busca) em `/admin/financeiro/lancamentos` | 2 |
| 4 | Dashboard financeiro + DRE + Relatórios (fórmulas §1) em `/admin/financeiro` | 2 |
| 5 | Rota de IA: provider adapter (SSE OpenAI-frame) + ai-classify (com correções #2/#3) no form de lançamento | 3 |
| 6 | CFO Digital (chat streaming + contexto unificado) + resumo executivo | 5 |
| 7 | Contas a pagar com alçada server-side (#1) + fechamento mensal (checklist + batch classify) | 3 |
| 8 | Orçamento + forecast (IA) + score financeiro | 4,5 |
| 9 | Motor `agent_actions` + agente de anomalias + cron na VPS (`CRON_SECRET`) | 7 |
| 10 | OCR de documentos (scanner + automações contato/conta a pagar/guia) | 5,7 |
| 11 | Adapter WhatsApp **Avisa API** + CFO por WhatsApp + smart-alerts (com #9) | 6,9 |
| 12 | Fiscal (condicional à decisão com o contador): worker NFS-e na VPS + emissão + gaps §4 | 1 + decisão |
| 13 | Conciliação bancária (condicional: Pluggy e/ou extrato manual) + tela de pendências | 3 |

Fora do plano (decidido no ADR-001): universo PF, multi-CNPJ, API pública, Banco Inter, Belvo.

## 7. Perguntas em aberto (negócio)

1. A Vamaq é Simples Nacional? (afeta prazos CBS/IBS e a via fiscal)
2. O que o contador diz que a Vamaq precisa emitir — NF-e de venda de veículo, NFS-e de comissão
   de consignação, ambas, nenhuma? (define o PR-12 e se PlugNotas entra)
3. A Vamaq usa/quer Asaas para cobranças? (agent-collections depende do espelho Asaas)
4. Conciliação bancária: qual banco a Vamaq usa? Pluggy (agregador) ou import manual de extrato?
5. Provedor de IA para o porte: Gemini direto ou Anthropic?
6. WhatsApp→lançamento (foto de comprovante vira despesa) é requisito? (é construção nova, §2)
