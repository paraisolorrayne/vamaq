-- ============================================================================
-- VAMAQ MOTORS — schema de autenticação do /admin (PR-B do ADR-002).
--
-- Fecha o /admin, hoje aberto na internet. Tabelas no schema `public` porque
-- servem o admin inteiro (estoque, documentos, criativos, FIPE), não só o
-- futuro módulo financeiro.
--
-- Papéis (ADR-001 Fase 3): admin (tudo) · financeiro (Finance AI + estoque) ·
-- vendedor (só CRM, quando existir).
--
-- Hash de senha: scrypt do node:crypto (sem dependência nova). Formato guardado
-- em password_hash: "scrypt$N$r$p$<salt_b64>$<hash_b64>".
--
-- Sessão: token aleatório em cookie httpOnly; no banco guarda-se só o SHA-256
-- do token (token_hash) — vazamento da tabela não expõe a sessão em claro.
--
-- Aplicar:  psql "$DATABASE_URL" -f db/auth-schema.sql   (seguro re-aplicar)
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists users (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  email                text not null unique,
  password_hash        text not null,
  role                 text not null default 'vendedor',
  active               boolean not null default true,
  must_change_password boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint users_role_check check (role in ('admin', 'estoque', 'financeiro', 'vendedor', 'secretaria'))
);

-- idempotente para bancos já criados antes desta coluna existir.
alter table users add column if not exists must_change_password boolean not null default false;

-- Papéis podem crescer; re-aplica o CHECK com o conjunto atual (idempotente).
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role in ('admin', 'estoque', 'financeiro', 'vendedor', 'secretaria'));

-- Alçada de aprovação (Contas a Pagar): valor que o usuário pode aprovar sozinho.
-- null = sem alçada própria (admin é sempre ilimitado, tratado na aplicação).
alter table users add column if not exists approval_limit numeric(15,2);

-- email sempre normalizado em minúsculas na aplicação; índice único já cobre.
create index if not exists users_active_idx on users(active) where active = true;

create table if not exists sessions (
  token_hash text primary key,               -- sha256(token) em hex
  user_id    uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_idx on sessions(user_id);
create index if not exists sessions_expires_idx on sessions(expires_at);

-- reaproveita o set_updated_at() já definido em db/schema.sql
drop trigger if exists users_set_updated_at on users;
create trigger users_set_updated_at
  before update on users
  for each row execute function set_updated_at();
