-- ============================================================================
-- VAMAQ MOTORS — quadro de pessoal (ficha do funcionário e passagens).
--
-- `funcionarios` é a pessoa; `funcionario_vinculos` é cada passagem pela loja
-- (admissão → saída). O CARGO mora no vínculo: promoção e readmissão viram
-- histórico sem tabela extra. O acesso ao sistema é opcional dos dois lados —
-- há funcionário sem login (mecânico) e login sem ficha (contador).
--
-- Aplicar:  psql "$DATABASE_URL" -f db/funcionarios-schema.sql  (re-aplicável)
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists funcionarios (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  cpf           text unique,               -- só dígitos; único quando informado
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

-- Garantia no banco (não só na aplicação): um vínculo aberto por pessoa.
create unique index if not exists funcionario_vinculo_aberto_idx
  on funcionario_vinculos(funcionario_id) where saida is null;

-- Elo com o acesso. `set null` evita login órfão se a ficha for removida.
alter table users add column if not exists funcionario_id uuid
  references funcionarios(id) on delete set null;
create unique index if not exists users_funcionario_idx
  on users(funcionario_id) where funcionario_id is not null;

-- reusa set_updated_at() de db/schema.sql
drop trigger if exists funcionarios_set_updated_at on funcionarios;
create trigger funcionarios_set_updated_at
  before update on funcionarios
  for each row execute function set_updated_at();

drop trigger if exists funcionario_vinculos_set_updated_at on funcionario_vinculos;
create trigger funcionario_vinculos_set_updated_at
  before update on funcionario_vinculos
  for each row execute function set_updated_at();
