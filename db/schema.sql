-- ============================================================================
-- VAMAQ MOTORS — schema Postgres "puro" (site público).
--
-- Versão enxuta, sem Supabase: sem Auth, sem Storage, sem RLS.
-- Cobre só o que o site público precisa: ler veículos e suas fotos.
-- As fotos são servidas como arquivos estáticos de /public/veiculos/<slug>/,
-- então `vehicle_images.url` guarda só o caminho público (ex: /veiculos/.../x.jpg).
--
-- Aplicar uma vez no banco:
--   psql "$DATABASE_URL" -f db/schema.sql
-- Seguro re-aplicar: tudo usa IF NOT EXISTS / DO $$ guards.
-- ============================================================================

create extension if not exists "pgcrypto";

do $$ begin
  create type vehicle_status as enum
    ('draft', 'processing', 'ready', 'published', 'sold', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vehicle_badge as enum ('Novo', 'Destaque', 'Blindado');
exception when duplicate_object then null; end $$;

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,

  brand text not null,
  model text not null,
  year integer not null,
  body_type text not null,
  color text not null,

  price numeric(12, 2),            -- null = "Consulte"
  mileage integer not null default 0,
  badge vehicle_badge,
  featured boolean not null default false,

  fuel text not null,
  transmission text not null,
  power text not null,

  spec_engine text,
  spec_acceleration text,
  spec_top_speed text,
  spec_doors integer,
  spec_seats integer,

  description text not null default '',

  status vehicle_status not null default 'draft',
  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint year_range check (year between 1950 and 2035),
  constraint mileage_non_negative check (mileage >= 0),
  constraint price_non_negative check (price is null or price >= 0)
);

create index if not exists vehicles_status_idx on vehicles(status);
create index if not exists vehicles_featured_idx on vehicles(featured) where featured = true;
create index if not exists vehicles_brand_idx on vehicles(brand);
create index if not exists vehicles_body_type_idx on vehicles(body_type);
create index if not exists vehicles_published_at_idx on vehicles(published_at desc);

create table if not exists vehicle_images (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,

  position integer not null default 0,
  is_primary boolean not null default false,

  -- Caminho público servido de /public (ex: /veiculos/<slug>/<arquivo>.jpg)
  url text not null,

  created_at timestamptz not null default now()
);

create index if not exists vehicle_images_vehicle_idx on vehicle_images(vehicle_id, position);

-- No máximo uma imagem primária por veículo.
create unique index if not exists vehicle_images_one_primary_per_vehicle
  on vehicle_images(vehicle_id)
  where is_primary = true;

-- Mantém updated_at em dia nos vehicles.
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
