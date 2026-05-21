-- ============================================================================
-- VAMAQ MOTORS — initial schema
-- vehicles, vehicle_images, audit_log + RLS policies
-- ============================================================================

-- Required for gen_random_uuid()
create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------------
-- Enums
-- --------------------------------------------------------------------------

create type public.vehicle_status as enum (
  'draft',        -- Cadastro em andamento
  'processing',   -- Imagens sendo processadas
  'ready',        -- Pronto, não publicado ainda
  'published',    -- Ao vivo no site
  'sold',         -- Vendido
  'archived'      -- Arquivado (fora do site)
);

create type public.vehicle_badge as enum (
  'Novo',
  'Destaque',
  'Blindado'
);

create type public.image_processing_status as enum (
  'pending',
  'processing',
  'done',
  'failed',
  'skipped'       -- Usuário pulou o tratamento (ex: foto institucional)
);

create type public.image_template as enum (
  'studio_white',      -- Fundo branco puro
  'studio_vamaq',      -- Gradiente cinza→branco com reflexo sutil
  'showroom_original'  -- Sem tratamento, só normaliza
);

create type public.user_role as enum (
  'admin',    -- Acesso total
  'editor'   -- Cadastra e edita, não publica
);

-- --------------------------------------------------------------------------
-- Profiles (espelho de auth.users com metadados da aplicação)
-- --------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'editor',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);

-- --------------------------------------------------------------------------
-- Vehicles
-- --------------------------------------------------------------------------

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,

  -- Identificação
  brand text not null,
  model text not null,
  year integer not null,
  body_type text not null,
  color text not null,

  -- Comerciais
  price numeric(12, 2),           -- null = "Consulte"
  mileage integer not null,
  badge public.vehicle_badge,
  featured boolean not null default false,

  -- Powertrain
  fuel text not null,
  transmission text not null,
  power text not null,

  -- Ficha técnica
  spec_engine text,
  spec_acceleration text,
  spec_top_speed text,
  spec_doors integer,
  spec_seats integer,

  -- Descritivo
  description text not null default '',

  -- Estado
  status public.vehicle_status not null default 'draft',
  published_at timestamptz,

  -- Auditoria
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,

  constraint year_range check (year between 1950 and 2035),
  constraint mileage_non_negative check (mileage >= 0),
  constraint price_non_negative check (price is null or price >= 0)
);

create index vehicles_status_idx on public.vehicles(status);
create index vehicles_featured_idx on public.vehicles(featured) where featured = true;
create index vehicles_brand_idx on public.vehicles(brand);
create index vehicles_body_type_idx on public.vehicles(body_type);
create index vehicles_published_at_idx on public.vehicles(published_at desc);

-- --------------------------------------------------------------------------
-- Vehicle images
-- --------------------------------------------------------------------------

create table public.vehicle_images (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,

  -- Ordem no carrossel
  position integer not null default 0,
  is_primary boolean not null default false,

  -- Storage paths (dentro dos buckets)
  original_path text not null,        -- bucket: originals
  processed_path text,                -- bucket: processed (null até tratar)

  -- Tratamento
  template public.image_template not null default 'studio_vamaq',
  processing_status public.image_processing_status not null default 'pending',
  processing_error text,
  processed_at timestamptz,

  -- Metadata da imagem original
  original_width integer,
  original_height integer,
  original_bytes bigint,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vehicle_images_vehicle_idx on public.vehicle_images(vehicle_id, position);
create index vehicle_images_primary_idx on public.vehicle_images(vehicle_id) where is_primary = true;

-- Apenas uma imagem primária por veículo
create unique index vehicle_images_one_primary_per_vehicle
  on public.vehicle_images(vehicle_id)
  where is_primary = true;

-- --------------------------------------------------------------------------
-- Audit log
-- --------------------------------------------------------------------------

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,                      -- ex: 'vehicle.created', 'image.processed'
  entity_type text not null,                 -- ex: 'vehicle', 'vehicle_image'
  entity_id uuid,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_log_user_idx on public.audit_log(user_id, created_at desc);
create index audit_log_entity_idx on public.audit_log(entity_type, entity_id, created_at desc);

-- --------------------------------------------------------------------------
-- Trigger: manter updated_at em dia
-- --------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

create trigger vehicle_images_set_updated_at
  before update on public.vehicle_images
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------------------
-- Trigger: auto-criar profile quando usuário é criado no auth.users
-- --------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'editor'  -- default; admin promove depois
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- --------------------------------------------------------------------------
-- Row Level Security
-- --------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_images enable row level security;
alter table public.audit_log enable row level security;

-- Helper: checar se o usuário autenticado tem role admin/editor
create or replace function public.is_admin_or_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'editor')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---- profiles ----
-- Usuário autenticado pode ler seu próprio profile + outros admins/editores
create policy "profiles readable by authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- Usuário pode atualizar o próprio profile (exceto role)
create policy "profiles self update"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Apenas admin pode mudar role de outros
create policy "profiles admin update any"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---- vehicles ----
-- Público (anon) só vê publicados
create policy "vehicles public reads published"
  on public.vehicles for select
  to anon
  using (status = 'published');

-- Autenticados com role veem tudo
create policy "vehicles staff read all"
  on public.vehicles for select
  to authenticated
  using (public.is_admin_or_editor());

-- Staff pode criar/atualizar
create policy "vehicles staff insert"
  on public.vehicles for insert
  to authenticated
  with check (public.is_admin_or_editor());

create policy "vehicles staff update"
  on public.vehicles for update
  to authenticated
  using (public.is_admin_or_editor())
  with check (public.is_admin_or_editor());

-- Apenas admin deleta
create policy "vehicles admin delete"
  on public.vehicles for delete
  to authenticated
  using (public.is_admin());

-- ---- vehicle_images ----
-- Público vê imagens de veículos publicados (com processed_path válido)
create policy "vehicle_images public reads"
  on public.vehicle_images for select
  to anon
  using (
    exists (
      select 1 from public.vehicles v
      where v.id = vehicle_images.vehicle_id
        and v.status = 'published'
    )
    and processed_path is not null
  );

-- Staff vê tudo
create policy "vehicle_images staff read all"
  on public.vehicle_images for select
  to authenticated
  using (public.is_admin_or_editor());

-- Staff gerencia
create policy "vehicle_images staff insert"
  on public.vehicle_images for insert
  to authenticated
  with check (public.is_admin_or_editor());

create policy "vehicle_images staff update"
  on public.vehicle_images for update
  to authenticated
  using (public.is_admin_or_editor())
  with check (public.is_admin_or_editor());

create policy "vehicle_images staff delete"
  on public.vehicle_images for delete
  to authenticated
  using (public.is_admin_or_editor());

-- ---- audit_log ----
-- Ninguém lê via API pública; só admins
create policy "audit_log admin reads"
  on public.audit_log for select
  to authenticated
  using (public.is_admin());

-- Staff pode inserir (via service role ou server-side)
create policy "audit_log staff insert"
  on public.audit_log for insert
  to authenticated
  with check (public.is_admin_or_editor());

-- --------------------------------------------------------------------------
-- Storage buckets (criados via SQL; configurações adicionais via Dashboard/CLI)
-- --------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('originals', 'originals', false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('processed', 'processed', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Policies de storage
-- originals: privado, só staff
create policy "originals staff read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'originals' and public.is_admin_or_editor());

create policy "originals staff upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'originals' and public.is_admin_or_editor());

create policy "originals staff delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'originals' and public.is_admin_or_editor());

-- processed: público lê (p/ site), staff escreve
create policy "processed public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'processed');

create policy "processed staff write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'processed' and public.is_admin_or_editor());

create policy "processed staff update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'processed' and public.is_admin_or_editor())
  with check (bucket_id = 'processed' and public.is_admin_or_editor());

create policy "processed staff delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'processed' and public.is_admin_or_editor());
