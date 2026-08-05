-- ============================================================================
-- VAMAQ MOTORS — emissão de NF-e (modelo 55) pela Focus NFe.
--
-- `notas_fiscais` espelha cada emissão: a `ref` é o identificador que enviamos
-- à Focus e não se reaproveita (nota rejeitada é reemitida com ref nova).
-- `fiscal_config` guarda os parâmetros que vêm do CONTADOR — nada de valor
-- fiscal chutado no código. A NUMERAÇÃO das notas é da Focus, não nossa.
--
-- Aplicar:  psql "$DATABASE_URL" -f db/fiscal-schema.sql      (re-aplicável)
-- ============================================================================

create extension if not exists "pgcrypto";

-- Chassi do veículo: obrigatório na nota, não existia no cadastro.
alter table vehicles add column if not exists chassi text;

create table if not exists notas_fiscais (
  id            uuid primary key default gen_random_uuid(),
  ref           text not null unique,      -- identificador da emissão na Focus
  vehicle_id    uuid not null references vehicles(id) on delete restrict,
  status        text not null default 'processando',
  numero        text,
  serie         text,
  chave         text,
  valor         numeric(12,2),
  destinatario  jsonb not null default '{}'::jsonb,
  mensagem      text,                      -- retorno da SEFAZ quando rejeita
  xml_url       text,
  danfe_url     text,
  justificativa_cancelamento text,
  cancelada_em  timestamptz,
  raw           jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint nota_status_check
    check (status in ('processando','autorizada','erro','cancelada'))
);

create index if not exists notas_fiscais_vehicle_idx on notas_fiscais(vehicle_id);
create index if not exists notas_fiscais_status_idx on notas_fiscais(status);

-- Linha única. Preenchida com os valores do contador (ver docs da spec).
create table if not exists fiscal_config (
  id            uuid primary key default gen_random_uuid(),
  cnpj          text,
  ie            text,
  im            text,
  regime_tributario text,
  cfop          text,
  cst           text,
  origem        text,       -- origem da mercadoria (grupo ICMS, 0-8)
  icms_modalidade_base_calculo text,
  ncm           text,
  serie         text,
  icms_seminovo_aliquota numeric(5,2) not null default 5,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Singleton: corrigir o CFOP/CST é UPDATE, não INSERT — um segundo INSERT
-- deixava o sistema emitindo com a config antiga, sem sinal nenhum
-- (getFiscalConfig lia a linha mais antiga por created_at).
create unique index if not exists fiscal_config_singleton on fiscal_config ((true));

-- reusa set_updated_at() de db/schema.sql
drop trigger if exists notas_fiscais_set_updated_at on notas_fiscais;
create trigger notas_fiscais_set_updated_at
  before update on notas_fiscais
  for each row execute function set_updated_at();

drop trigger if exists fiscal_config_set_updated_at on fiscal_config;
create trigger fiscal_config_set_updated_at
  before update on fiscal_config
  for each row execute function set_updated_at();
