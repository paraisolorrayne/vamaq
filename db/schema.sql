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

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint year_range check (year between 1950 and 2035),
  constraint quilometragem_non_negative check (quilometragem >= 0),
  constraint price_non_negative check (price is null or price >= 0)
);

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
