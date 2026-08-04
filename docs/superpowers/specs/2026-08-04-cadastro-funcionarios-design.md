# Cadastro de funcionários ligado ao acesso do sistema

**Data:** 2026-08-04 · **Status:** aprovado, pronto para plano de implementação

## Problema

A tabela `users` (`db/auth-schema.sql`) guarda só nome, e-mail, papel, ativo e
alçada de aprovação. Ela responde "quem pode entrar no sistema hoje", mas não
responde "quem trabalha ou trabalhou na loja, em que cargo e por quanto tempo".
Desativar um usuário apenas corta o acesso — não conta a história.

A Vamaq precisa do registro do quadro de pessoal, com histórico preservado
quando alguém sai e quando alguém volta.

## Decisões tomadas

| Questão | Decisão |
|---|---|
| Escopo da ficha | Dados cadastrais + admissão/saída. **Sem** ponto, férias, salário ou folha. |
| Vínculo com o login | Funcionário é a base; login é opcional dos dois lados. |
| Readmissão | Guarda cada passagem pela loja. |
| Acesso à informação | Só `admin` vê e edita (mesma regra de `/admin/usuarios`). |
| Modelagem | Tabelas relacionais (`funcionarios` + `funcionario_vinculos`), não jsonb. |

Descartado: guardar as passagens em jsonb no estilo `vehicles.renave` (consulta
por período vira gambiarra) e engordar `users` com campos de RH (obrigaria login
para todo mundo e mistura dado pessoal com credencial).

Fora de escopo: RENAVE (retomar perto de 30/09/2026), folha de pagamento,
documentos anexados à ficha.

## Schema — `db/funcionarios-schema.sql`

Schema `public`, escrito pela role do app (`vamaq`), arquivo idempotente e
seguro de re-aplicar, no padrão de `db/crm-schema.sql`.

```sql
create table if not exists funcionarios (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  cpf           text unique,        -- só dígitos; único quando informado
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

-- No máximo um vínculo aberto por funcionário (garantia no banco, não na app).
create unique index if not exists funcionario_vinculo_aberto_idx
  on funcionario_vinculos(funcionario_id) where saida is null;

-- Elo com o acesso: opcional dos dois lados, um login por ficha.
alter table users add column if not exists funcionario_id uuid
  references funcionarios(id) on delete set null;
create unique index if not exists users_funcionario_idx
  on users(funcionario_id) where funcionario_id is not null;
```

Trigger `set_updated_at()` (já definido em `db/schema.sql`) nas duas tabelas.

**Por que o cargo fica no vínculo:** promoção e readmissão viram histórico sem
tabela extra. O "cargo atual" é o cargo do vínculo aberto.

## Camada de dados — `src/lib/rh/`

`funcionarios.js` (server-only, usa `query` de `@/lib/db`):

- `listFuncionarios()` — ficha + vínculo atual (cargo, admissão) + login
  vinculado, ordenado por nome. Inclui desligados, com a situação calculada.
- `getFuncionario(id)` — ficha, todos os vínculos (mais recente primeiro) e o
  usuário vinculado.
- `createFuncionario(data)` / `updateFuncionario(id, data)` — valida nome
  obrigatório e CPF (ver abaixo); erro amigável se o CPF já existir.
- `admitir(funcionarioId, { cargo, admissao, obs })` — cria vínculo. Se já houver
  um aberto, o índice único rejeita e a função devolve
  `{ error: "Este funcionário já tem um vínculo em aberto." }`.
- `desligar(funcionarioId, { saida, motivo })` — fecha o vínculo aberto **e**
  desativa o login vinculado num único comando, de forma atômica:

  ```sql
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
  ```

  Uma só instrução: não existe janela em que a pessoa está desligada e o login
  continua válido. O retorno diz o que aconteceu — `vinculo_id` nulo significa
  que não havia vínculo aberto (a função devolve erro), e `user_id` nulo apenas
  indica que a pessoa não tinha login.

`cpf.js` — `normalizeCpf(v)` (só dígitos) e `isValidCpf(v)` (dígito verificador,
rejeita sequências repetidas). Sem dependência nova.

**Readmissão não reativa o login.** A senha antiga está velha e a decisão é do
admin: a ficha mostra o aviso com atalho para redefinir em `/admin/usuarios`.

## Telas

Nova seção em `src/lib/auth/permissions.js`:
`{ key: "funcionarios", prefix: "/admin/funcionarios", label: "Funcionários", icon: "🧑‍🔧", roles: [] }`
— `roles: []` significa só admin, igual a Usuários. Incluir na ordem de
`navFor()` logo antes de `usuarios`.

**`/admin/funcionarios`** — lista com nome, cargo atual, admissão, situação
(Ativo/Desligado) e acesso (e-mail do login ou "sem acesso"). Formulário de nova
ficha no topo, no formato já usado em `/admin/usuarios`.

**`/admin/funcionarios/[id]`** — a ficha:

1. Dados pessoais, editáveis.
2. Linha do tempo das passagens: cargo, admissão, saída, motivo.
3. Ações: **Desligar** (pede data e motivo) ou **Readmitir** (pede cargo e data),
   conforme haja ou não vínculo aberto.
4. Bloco "Acesso ao sistema": com login, mostra e-mail e papel com link para
   `/admin/usuarios`; sem login, botão **Criar acesso** que reaproveita
   `createUser` — gera senha temporária e o mesmo texto copiável de instruções —
   já gravando `funcionario_id`.

**`/admin/usuarios`** — ganha a coluna Funcionário (nome com link para a ficha,
ou "—") e um seletor opcional "vincular a funcionário" na criação. Continua
sendo a tela de *acessos*; a ficha é a tela de *pessoas*.

Server actions em `src/app/admin/funcionarios/actions.js`, todas iniciando com
`await requireRole("admin")`, seguindo `src/app/admin/usuarios/actions.js`.

## Erros e validação

- Nome obrigatório; cargo e admissão obrigatórios no vínculo.
- `saida >= admissao` (CHECK no banco e mensagem na tela).
- Dois vínculos abertos: barrado pelo índice único.
- CPF inválido ou duplicado: mensagem clara, sem stack trace.
- Desligar quem já está desligado / readmitir quem já está ativo: as ações são
  mutuamente exclusivas na interface e verificadas no servidor.
- Fichas não são apagadas pela interface. `on delete set null` em
  `users.funcionario_id` evita login órfão caso alguma ficha seja removida
  manualmente no banco.

## Migração dos dados existentes

Nada automático. Mateus, Louanny e Victor recebem ficha pela tela e o vínculo é
feito no seletor de `/admin/usuarios`. São três pessoas — script traria mais
risco que ganho. Usuários que não são funcionários (Lorrayne, contador) ficam
sem ficha, por desenho.

## Testes — `npm test` (node:test, `--test-concurrency=1`)

- `tests/rh-cpf.test.mjs` — dígito verificador, entrada com pontuação,
  sequências repetidas, valores vazios.
- `tests/rh-funcionarios.test.mjs` — criar ficha → admitir → desligar (verifica
  que o login vinculado ficou `active = false`) → readmitir cria o segundo
  vínculo → segundo vínculo aberto é rejeitado. Segue o padrão de
  `tests/fin-schema.test.mjs`.

## Deploy

```
cd /var/www/vamaq && git pull origin main
psql "$DATABASE_URL" -f db/funcionarios-schema.sql
npm install && npm run build && pm2 restart vamaq
```

O `funcionarios-schema.sql` roda **antes** do build, como em qualquer mudança de
schema (ver `docs/DEPLOY-POSTGRES-VPS.md`).
