# Vamaq Motors — Documentação técnica

| Documento | Conteúdo |
|-----------|----------|
| [`SUPABASE-SETUP.md`](./SUPABASE-SETUP.md) | Passo-a-passo para criar o projeto Supabase, rodar migrações, popular seed e conectar o Next.js. |

## Arquitetura (alto nível)

```
┌───────────────────────────────┐      ┌──────────────────────────┐
│       Next.js 16 (VPS)        │      │      Supabase (cloud)    │
│                               │      │                          │
│  • Site público               │      │  • Postgres              │
│    (/ /acervo /veiculo/...)   │◄────►│  • Auth                  │
│  • /admin (Fase 2+)           │      │  • Storage:              │
│  • Server Components          │      │     - originals (priv.)  │
│  • repository layer           │      │     - processed (pub.)   │
│  • image processor (Fase 3)   │      │  • RLS policies          │
│                               │      │                          │
└───────────────────────────────┘      └──────────────────────────┘
             │
             ▼
    ┌──────────────────┐
    │ Replicate API    │   ← background removal (Fase 3)
    │ (briaai/RMBG)    │
    └──────────────────┘
```

## Camadas de dados

| Caminho | Função |
|---------|--------|
| `src/data/vehicles.js` | Mock fallback (10 veículos hardcoded) + helpers puros (WhatsApp URLs). |
| `src/lib/repositories/vehicles.js` | **API única** para o site consumir dados (`getAllVehicles`, `getVehicleBySlug`, etc). Detecta env vars e escolhe entre Supabase e mock. |
| `src/lib/supabase/{client,server,admin}.js` | Wrappers Supabase: browser, RSC/server actions, e service role. |
| `supabase/migrations/` | SQL versionado aplicado via `supabase db push`. |
| `supabase/seed.sql` | Dados iniciais idempotentes. |

## Modos de execução

O site funciona em dois modos, decididos em runtime pela presença das env vars:

- **Mock mode** — sem `.env.local`. Usa `src/data/vehicles.js`. Útil em desenvolvimento offline.
- **DB mode** — com `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Lê do Postgres. Na ausência de veículos publicados, `/acervo` aparece vazio (sem fallback pro mock).

## Fases do projeto

- [x] **Fase 1** — Migração dos dados pro Supabase (este PR).
- [ ] **Fase 2** — `/admin` shell: login + CRUD de metadados.
- [ ] **Fase 3** — Pipeline de imagens (upload → Replicate → sharp → approve).
- [ ] **Fase 4** — Publishing flow + revalidation on-demand.
- [ ] **Fase 5** — Deploy VPS (Node 20 + PM2 + nginx + Let's Encrypt).
