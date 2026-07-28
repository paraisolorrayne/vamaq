-- ============================================================================
-- VAMAQ MOTORS — CRM de vendas (funil de oportunidades).
--
-- Vive no schema `public` e é escrito pela role do app (vamaq) — o vendedor
-- trabalha os leads e, ao ganhar, pode marcar o veículo como vendido (mesma
-- role que já cuida do estoque). Liga cada oportunidade a um veículo de interesse.
--
-- Aplicar:  psql "$DATABASE_URL" -f db/crm-schema.sql        (seguro re-aplicar)
-- ============================================================================

create table if not exists oportunidades (
  id             uuid primary key default gen_random_uuid(),
  cliente_nome   text not null,
  telefone       text,
  email          text,
  vehicle_id     uuid references vehicles(id) on delete set null,
  etapa          text not null default 'novo',
  valor          numeric(12,2),
  origem         text,                       -- WhatsApp, Instagram, Indicação, Site...
  obs            text,
  responsavel_id uuid references users(id) on delete set null,
  motivo_perda   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint oport_etapa_check
    check (etapa in ('novo','contato','proposta','negociacao','ganho','perdido'))
);
create index if not exists oport_etapa_idx on oportunidades(etapa);
create index if not exists oport_responsavel_idx on oportunidades(responsavel_id);
create index if not exists oport_vehicle_idx on oportunidades(vehicle_id) where vehicle_id is not null;

-- reusa set_updated_at() do db/schema.sql
drop trigger if exists oportunidades_set_updated_at on oportunidades;
create trigger oportunidades_set_updated_at
  before update on oportunidades
  for each row execute function set_updated_at();
