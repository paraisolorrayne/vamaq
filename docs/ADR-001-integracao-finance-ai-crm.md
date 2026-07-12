# ADR-001 — Integração Finance AI + CRM Automotivo via Claude Code (banco interno)

**Status:** Proposto · **Data:** 2026-07-11 · **Branch de trabalho:** `feat/integracao-finance-ai-crm`

## Contexto

A Dexi Digital vai integrar dois módulos prontos (Finance AI e CRM Automotivo), ambos gerados no
Lovable, dentro da área de admin do site da Vamaq. O fluxo escolhido é: exportar o código gerado
pelo Lovable, versionar no GitHub e usar o Claude Code para integrar os módulos no codebase
principal. O banco de dados será o interno da concessionária, não o Supabase cloud das soluções
originais.

## Decisão

Exportar Finance AI e CRM Automotivo do Lovable como projetos React, versionar no GitHub, e usar
Claude Code como copiloto de integração no codebase do site. O Supabase embutido nas soluções será
substituído pelo banco interno já existente.

## Estado atual do codebase (levantado em 2026-07-11 — ajusta o plano original)

| Premissa do ADR original | Realidade neste repo | Impacto |
|---|---|---|
| "Criar instância PostgreSQL interna" (Fase 2, passo 5) | **Já existe**: Postgres na VPS (`/var/www/vamaq`, pm2 `vamaq`), schema em `db/schema.sql`, cliente `pg` + camada `src/lib/repositories/` | Fase 2 vira **estender o schema** com as tabelas dos módulos, não criar banco |
| "Unificar o sistema de autenticação" (Fase 3, passo 9) | O `/admin` **não tem autenticação** hoje (layout é só navegação) | Não há auth para unificar — é preciso **criar** (ex.: NextAuth/JWT + tabela `users`) **antes** de expor dados financeiros e de CRM; vira pré-requisito da Fase 3 |
| Módulos como React SPA em monorepo (Turborepo/Nx) | Site é **Next.js 16 App Router** (server components, rotas `/admin/*`, APIs em `/app/api/admin/*`) | Integração = **portar** componentes/fluxos para rotas `/admin/financeiro` e `/admin/crm` + APIs internas; monorepo provavelmente desnecessário (decisão a validar quando os exports existirem) |
| "Conectar API FIPE" (Fase 4, passo 12) | Já existe `/admin/fipe` e `/api/admin/fipe` | Reusar o client FIPE existente no módulo de avaliação do CRM |
| RLS policies do Supabase | O site não usa RLS; permissão será aplicada na camada de API/middleware | Policies exportadas do Lovable viram o **mapa de permissões** do middleware próprio |

## Arquitetura revisada

```
[Lovable]
   | export ("Open in GitHub")
[GitHub]
   |--- finance-ai-module          (export puro, referência)
   |--- crm-automotivo-module      (export puro, referência)
   |--- vamaq                      (codebase principal — integração acontece AQUI)
        |
   [Claude Code]  (porta módulos para /admin, troca supabase-js por pg/repositories)
        |
   [/admin do site Vamaq]  →  [Postgres interno na VPS]  →  [APIs: Fiscal | Bancária | FIPE]
```

## Fases

### Fase 1 — Extração e versionamento  ⛔ bloqueada: export manual no painel do Lovable
1. No Lovable, exportar cada projeto via "Open in GitHub" → repos `finance-ai-module` e
   `crm-automotivo-module` na conta `paraisolorrayne` (em 2026-07-11 ainda não existiam).
2. Inspecionar as migrations SQL geradas (`supabase/migrations/`) — são o mapa do banco a recriar.
3. Documentar tabelas, relacionamentos e RLS policies de cada módulo **antes** de qualquer migração
   (vira anexo deste ADR: `docs/ADR-001a-schema-finance-ai.md` e `ADR-001b-schema-crm.md`).

### Fase 2 — Banco interno (estender, não criar)
4. Traduzir as migrations do Lovable para o padrão de `db/schema.sql` (idempotente, `create table
   if not exists`), removendo o que é específico do Supabase (schema `auth.*`, `storage.*`,
   policies RLS).
5. Aplicar primeiro em banco local/staging; só depois na VPS.
6. **Backup antes de qualquer dado real**: `pg_dump` automático agendado na VPS (pré-requisito de
   go-live, dado financeiro e de estoque).

### Fase 3 — Integração via Claude Code (um módulo por vez)
7. **Pré-requisito: autenticação do /admin** — criar login (tabela `users`, sessão JWT ou
   NextAuth) com papéis mínimos: `admin` (tudo), `financeiro` (Finance AI + estoque), `vendedor`
   (só CRM). Hoje o /admin é aberto; integrar módulos financeiros sem isso é inaceitável.
8. Começar pelo **CRM Automotivo** (mais simples): portar componentes para `/admin/crm`, reescrever
   chamadas `supabase-js` → repositórios `pg` (`src/lib/repositories/`), validar no admin,
   commitar. Só então integrar o **Finance AI** em `/admin/financeiro`.
9. Gerar testes dos fluxos críticos (registro de venda, lançamento financeiro, emissão de NF).

### Fase 4 — APIs externas
10. Fiscal (Focus NFe ou eNotas) via variável de ambiente em `.env.local` — validar antes com o
    contador da Vamaq qual emissor o município (Uberlândia-MG) aceita para NFS-e.
11. FIPE: reusar o client existente (`/api/admin/fipe`).
12. Bancária (Pluggy ou Belvo) **somente se** conciliação bancária for requisito confirmado.

### Fase 5 — Deploy e validação
13. Staging antes de produção (a VPS atual só tem produção — definir se haverá app pm2 de staging
    ou validação local).
14. Validar fluxo ponta a ponta: cadastro de veículo → venda → lançamento financeiro → emissão NF.
15. Backups automáticos confirmados antes do go-live.

## Passos de negócio (inalterados do ADR original)

- **Antes:** mapear usuários/permissões do admin; verificar sistema legado com dados históricos
  (migração pré-go-live); validar provedor fiscal com o contador.
- **Durante:** validar UX do admin com o gestor da Vamaq; definir KPIs do dia 1 (veículos em
  estoque, receita do mês, leads no pipeline).
- **Go-live:** treinamento do time; SLA de suporte interno; rollback com sistema anterior em
  paralelo por 30 dias.

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Remoção do supabase-js quebra lógica que dependia de RLS | Mapear todas as policies na Fase 1 (anexos 001a/001b) e reescrevê-las como checagens de papel no middleware/APIs |
| Conflito de dependências entre os codebases Lovable e o site | Módulos são **portados** para o site (não montados como apps separados); exports ficam como repos de referência |
| Admin sem auth expondo dado financeiro | Auth é pré-requisito bloqueante da Fase 3 (passo 7) |
| Banco de produção sem backup | `pg_dump` agendado antes de qualquer dado real (Fase 2, passo 6) |
| Refactor inconsistente entre módulos | Um módulo por vez: CRM → validar → commitar → Finance AI |

## Decisões de escopo registradas (2026-07-11, Lorrayne)

1. **Tenancy**: trabalharemos apenas com o CNPJ da Vamaq. O schema portado mantém `company_id`
   (custo zero, preserva o código e reabre multi-loja no futuro) com uma única row em `companies`.
2. **WhatsApp**: substituir Evolution API por **Avisa API**
   (https://www.postman.com/mw10/avisa-api/documentation/fjeb27a/avisa-api). O porte do módulo de
   mensageria será feito atrás de um adapter, trocando o provider; usar o repo
   `paraisolorrayne/avisa-connect-hub` como referência de integração. (A doc no Postman é
   JS-rendered — mapear endpoints manualmente na hora do porte.)
3. **NFS-e**: a Vamaq **não emite NFS-e hoje**. Buscar a solução mais em conta — a candidata
   natural é a via própria NFS-e Nacional já presente no Finance AI (custo zero por nota; o
   `nfse-worker` roda na nossa VPS), ficando PlugNotas só se surgir necessidade de NFe/NFCe.
   Validar com o contador da Vamaq (emissor aceito no município + prazo Simples 01/09/2026).
4. **Estoque centralizado no site**: o cadastro de veículos permanece no admin do site — a tabela
   `vehicles` é a **fonte única de verdade** — e os demais sistemas (CRM, Finance AI) consomem
   dela. Veículo não é excluído nem recadastrado: ciclo de vida por status
   (habilitar/desabilitar; hoje já existe `published`, a evoluir para status de ciclo de vida —
   ex.: disponível/reservado/vendido/inativo — quando o CRM chegar), preservando o histórico do
   veículo dentro da Vamaq mesmo quando ele sai e volta ao estoque.

## Próximas ações

| # | Ação | Dono | Status |
|---|------|------|--------|
| 1 | Exportar Finance AI do Lovable para o GitHub | Lorrayne | ✅ `chat-finances-ai` |
| 2 | Analisar export Finance AI (anexo 001a) | Claude Code | ✅ [ADR-001a](./ADR-001a-analise-finance-ai.md) |
| 3 | Exportar CRM Automotivo (remix) e analisar (anexo 001b) | Lorrayne → Claude Code | ⏳ export em andamento |
| 4 | Definir solução de auth do /admin e implementar | Claude Code (validar abordagem com Lorrayne) | pendente |
| 5 | Desenhar ciclo de vida do veículo em `vehicles` (status) + contrato de consumo pelos módulos | Claude Code (após 001b) | pendente |
| 6 | Fase 2 em diante, na ordem | Claude Code | pendente |
