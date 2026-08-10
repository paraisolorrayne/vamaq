-- ============================================================================
-- VAMAQ MOTORS — CRM de vendas (funil de oportunidades).
--
-- Vive no schema `public` e é escrito pela role do app (vamaq) — o vendedor
-- trabalha os leads e, ao ganhar, pode marcar o veículo como vendido (mesma
-- role que já cuida do estoque). Liga cada oportunidade a um veículo de interesse
-- e, opcionalmente, a um cliente do cadastro (cliente_id).
--
-- Depende de db/clientes-schema.sql já aplicado: oportunidades.cliente_id
-- referencia clientes(id).
--
-- Aplicar:  psql "$DATABASE_URL" -f db/clientes-schema.sql   (nesta ordem)
--           psql "$DATABASE_URL" -f db/crm-schema.sql        (seguro re-aplicar)
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

-- Vínculo com o cadastro de clientes: sem ele, um carro vendido pelo CRM não
-- aparece na ficha do cliente. Requer que db/clientes-schema.sql já tenha
-- rodado (é de lá que vem a tabela `clientes`).
alter table oportunidades add column if not exists cliente_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'oportunidades_cliente_fk') then
    -- set null, não cascade: apagar o cadastro do cliente não pode apagar a
    -- oportunidade, que é o histórico da negociação.
    alter table oportunidades add constraint oportunidades_cliente_fk
      foreign key (cliente_id) references clientes(id) on delete set null;
  end if;
end $$;
create index if not exists oport_cliente_idx on oportunidades(cliente_id) where cliente_id is not null;

-- reusa set_updated_at() do db/schema.sql
drop trigger if exists oportunidades_set_updated_at on oportunidades;
create trigger oportunidades_set_updated_at
  before update on oportunidades
  for each row execute function set_updated_at();
