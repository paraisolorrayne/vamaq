# Supabase — setup inicial

Guia passo-a-passo para criar o projeto Supabase da Vamaq Motors, rodar as migrações e popular os dados iniciais.

Quando estes passos estiverem concluídos, o site passa automaticamente de **mock mode** (10 carros hardcoded) para **DB mode** (Supabase).

---

## 1. Pré-requisitos

- Conta no [Supabase](https://supabase.com/dashboard) (free tier serve).
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) instalado:
  ```bash
  brew install supabase/tap/supabase
  # ou
  npm install -g supabase
  ```
- Docker instalado (opcional — apenas para desenvolvimento local).

---

## 2. Criar o projeto no Supabase

1. Vá em <https://supabase.com/dashboard/new>.
2. Preencha:
   - **Name**: `vamaq-motors`
   - **Database password**: gere uma senha forte e **guarde no 1Password/cofre de senhas**.
   - **Region**: `South America (São Paulo)` — menor latência para o público BR.
   - **Pricing plan**: Free.
3. Aguarde ~2 minutos até o projeto ficar pronto.

---

## 3. Linkar o CLI ao projeto

Do diretório `site/`:

```bash
cd site
supabase login
supabase link --project-ref SEU_PROJECT_REF
```

O `SEU_PROJECT_REF` está na URL: `https://supabase.com/dashboard/project/<PROJECT_REF>`.

---

## 4. Aplicar as migrações

```bash
supabase db push
```

Isso executa `supabase/migrations/0001_init.sql` no banco remoto. Saída esperada:

```
Applying migration 0001_init.sql...
Finished supabase db push.
```

---

## 5. Popular os 10 veículos iniciais (seed)

```bash
supabase db seed --local=false --file supabase/seed.sql
```

Ou via Dashboard → SQL Editor → cole o conteúdo de `supabase/seed.sql` → Run.

Verificação rápida:

```sql
select count(*) from vehicles;           -- 10
select brand, model, status from vehicles order by created_at;
```

---

## 6. Criar o primeiro admin

O trigger `handle_new_auth_user` cria um `profile` automaticamente com role `editor`. Promova a conta da Lorrayne para `admin`:

1. Dashboard → **Authentication → Users → Invite user** → envie convite para `devforaiagents@gmail.com` (ou email preferido).
2. Aceite o convite e defina senha.
3. Dashboard → **SQL Editor**, rode:
   ```sql
   update public.profiles
      set role = 'admin'
    where email = 'devforaiagents@gmail.com';
   ```
4. Repita (convite + promote) para Mateus e esposa dele, mas role pode ser `editor` se não quiser dar poder de deletar.

---

## 7. Configurar as variáveis no Next.js

1. Copie o arquivo exemplo:
   ```bash
   cp .env.local.example .env.local
   ```
2. Pegue as chaves em **Supabase Dashboard → Project Settings → API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY` (⚠️  nunca commit)
3. Salve e reinicie o `npm run dev`.

---

## 8. Verificação end-to-end

Com `.env.local` preenchido, o site começa a ler do Supabase:

```bash
curl -s http://localhost:3000/acervo | grep -o "Porsche 911" | head -1
# Resultado esperado: "Porsche 911"
```

Se vir os 10 carros do seed aparecendo em `/acervo` e `/veiculo/<slug>`, a Fase 1 está concluída.

---

## 9. Troubleshooting

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| Site renderiza mas /acervo vazio | Nenhum veículo com `status='published'` | Rode o seed ou publique manualmente via SQL. |
| Erro 500 no /acervo | RLS bloqueando `anon` | Confirme que as policies foram criadas: `select * from pg_policies where tablename='vehicles';` |
| `supabase db push` falha | Shadow DB port em uso | Pare Docker Desktop + `supabase stop` + retry. |
| Site continua em mock mode | Env vars não carregaram | `rm -rf .next && npm run dev` |

---

## 10. Próximos passos (depois desta fase)

- **Fase 2** — Admin shell (`/admin` com login Supabase Auth + CRUD de metadados)
- **Fase 3** — Pipeline de tratamento de imagem (Replicate + sharp)
- **Fase 4** — Publishing flow + revalidation
- **Fase 5** — Deploy no VPS com Node 20 + PM2 + nginx
