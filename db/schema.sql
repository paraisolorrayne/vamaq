-- ============================================================================
-- VAMAQ MOTORS — schema Postgres (site público + admin).
--
-- Shape unificado: campos escalares em colunas + estruturas em jsonb
-- (opcionais, blindagem, images {main,gallery}, specs). Bate com o admin
-- (/admin/estoque) e com o repositório público.
--
-- Fotos: servidas como arquivos estáticos.
--   - Seed inicial: /veiculos/<slug>/<arquivo>.jpg
--   - Uploads do admin (com bg-removal): /images/vehicles/<uuid>.webp
-- Guardadas em `images` jsonb: { "main": "<url>", "gallery": ["<url>", ...] }.
--
-- Aplicar:  psql "$DATABASE_URL" -f db/schema.sql   (seguro re-aplicar)
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,

  brand text not null,
  model text not null,
  year integer not null,
  price numeric(12, 2),                       -- null = "Sob Consulta"
  quilometragem integer not null default 0,
  fuel text not null default 'Gasolina',
  transmission text not null default 'Automático',
  power text not null default '',
  color text not null default '',
  body_type text not null default 'Sedan',
  featured boolean not null default false,
  badge text,                                 -- null | 'Novo' | 'Destaque' | 'Blindado'

  opcionais jsonb not null default '[]'::jsonb,
  blindagem jsonb not null default '{"blindado": false, "tipo": ""}'::jsonb,
  images    jsonb not null default '{"main": "", "gallery": []}'::jsonb,
  specs     jsonb not null default '{"engine": "", "acceleration": "", "topSpeed": "", "doors": 4, "seats": 5}'::jsonb,

  description text not null default '',
  published boolean not null default true,    -- false = oculto no site público

  -- Ciclo de vida do veículo (PR-C do ADR-002). `published` segue sendo o
  -- único critério de exibição pública; `status` preserva o histórico do carro
  -- dentro da Vamaq (vendido/inativo não são apagados, só saem do site).
  status text not null default 'disponivel',

  -- Inventário (PR-Inventário). Dados internos, NÃO exibidos no site público.
  -- placa: null/'' = pendência. documentos: metadados dos arquivos (CRLV, CRV,
  -- NF...) — os arquivos ficam em disco privado (data/vehicle-docs/), servidos
  -- só com login. Shape: [{ id, tipo, nome, arquivo, tamanho, uploaded_at }].
  placa text,
  documentos jsonb not null default '[]'::jsonb,

  -- RENAVE (Registro Nacional de Veículos em Estoque) — Resolução Contran
  -- 1.026/2026, obrigatório nacionalmente. Rastreamento do ciclo entrada→saída.
  -- { status: nao_iniciado|entrada|registrado|saida, protocolo, obs }.
  renave jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint year_range check (year between 1950 and 2035),
  constraint quilometragem_non_negative check (quilometragem >= 0),
  constraint price_non_negative check (price is null or price >= 0),
  constraint status_valido check (status in ('disponivel', 'reservado', 'vendido', 'inativo'))
);

-- idempotente para bancos já criados antes das colunas existirem.
alter table vehicles add column if not exists status text not null default 'disponivel';
alter table vehicles add column if not exists placa text;
alter table vehicles add column if not exists documentos jsonb not null default '[]'::jsonb;
alter table vehicles add column if not exists renave jsonb not null default '{}'::jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'status_valido') then
    alter table vehicles add constraint status_valido
      check (status in ('disponivel', 'reservado', 'vendido', 'inativo'));
  end if;
end $$;

-- Ano de modelo (opcional). `year` continua sendo o ano de FABRICAÇÃO e o
-- único usado em filtro, ordenação e slug — ano_modelo só entra na exibição
-- (ver src/lib/anoVeiculo.js). Sem essa coluna preenchida, nada muda em
-- nenhuma tela.
alter table vehicles add column if not exists ano_modelo integer;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ano_modelo_check') then
    -- O ano do modelo nunca é anterior ao de fabricação. Não travamos em
    -- year + 1: existe carro fabricado em dezembro com modelo dois anos à
    -- frente, e uma trava esperta aqui vira chamado de suporte depois.
    alter table vehicles add constraint ano_modelo_check
      check (ano_modelo is null or (ano_modelo between 1950 and 2036 and ano_modelo >= year));
  end if;
end $$;

create index if not exists vehicles_published_idx on vehicles(published);
create index if not exists vehicles_featured_idx on vehicles(featured) where featured = true;
create index if not exists vehicles_brand_idx on vehicles(brand);
create index if not exists vehicles_body_type_idx on vehicles(body_type);
create index if not exists vehicles_created_at_idx on vehicles(created_at desc);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists vehicles_set_updated_at on vehicles;
create trigger vehicles_set_updated_at
  before update on vehicles
  for each row execute function set_updated_at();
