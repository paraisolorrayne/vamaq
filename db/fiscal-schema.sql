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

-- ---------------------------------------------------------------------------
-- Parâmetros descobertos nas NOTAS REAIS da Vamaq (12/08/2026).
--
-- Até aqui a config só tinha CFOP/CST/NCM/série, e o resto do que a SEFAZ
-- exige estava ausente do payload — cada campo faltando virava uma emissão
-- recusada, um erro por vez, com a Mayra do outro lado. Estes defaults saem
-- da NF 12 (venda, protocolo 131267805126821), que a SEFAZ autorizou.
-- Ver docs/superpowers/specs/2026-08-12-parametros-nfe-reais.md.
--
-- `add column if not exists` com default preenche as linhas que já existem,
-- então a linha de produção é atualizada sozinha — mas só onde a coluna é
-- NOVA. Coluna que já existia e está vazia precisa do update lá embaixo.
-- ---------------------------------------------------------------------------
alter table fiscal_config add column if not exists razao_social text not null default 'VAMAQ MOTORS';
alter table fiscal_config add column if not exists uf text not null default 'MG';
alter table fiscal_config add column if not exists natureza_operacao text not null default 'Venda Dentro do Estado';

-- ICMS: a base é a MARGEM (venda − aquisição), levada à nota como um percentual
-- de redução calculado por nota. 'reducao_fixa' + icms_reducao_base é a saída
-- caso o contador responda que o percentual é fixo — sem tocar em código.
alter table fiscal_config add column if not exists icms_base_metodo text not null default 'margem';
alter table fiscal_config add column if not exists icms_reducao_base numeric(7,4) not null default 95.238;

-- PIS/COFINS cumulativos (Lucro Presumido), sobre a base do ICMS menos o ICMS.
alter table fiscal_config add column if not exists pis_situacao_tributaria text not null default '01';
alter table fiscal_config add column if not exists pis_aliquota numeric(6,4) not null default 0.65;
alter table fiscal_config add column if not exists cofins_situacao_tributaria text not null default '01';
alter table fiscal_config add column if not exists cofins_aliquota numeric(6,4) not null default 3;

-- Obrigatórios no schema da NF-e 4.00 e que não mandávamos.
-- modalidade_frete 1 = por conta do destinatário (FOB): a Vamaq não contrata frete.
alter table fiscal_config add column if not exists modalidade_frete text not null default '1';
alter table fiscal_config add column if not exists presenca_comprador text not null default '1';
alter table fiscal_config add column if not exists consumidor_final text not null default '1';

-- Coluna antiga que existe em produção com string vazia: sem isto, a nota sai
-- sem modBC e a SEFAZ recusa. 3 = valor da operação.
update fiscal_config
   set icms_modalidade_base_calculo = '3'
 where icms_modalidade_base_calculo is null
    or trim(icms_modalidade_base_calculo) = '';

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

-- ---------------------------------------------------------------------------
-- Respostas do contador Rodrigo (14/08/2026) — ver a spec de parâmetros.
-- ---------------------------------------------------------------------------

-- Frete: "sem ocorrência de transporte" (9), não mais 1. O comprador sai
-- dirigindo o carro; não há transporte a declarar. As notas de agosto saíram
-- com 1 e foram autorizadas, mas o certo é 9.
update fiscal_config set modalidade_frete = '9' where modalidade_frete = '1';

-- Grupo de pagamento: a prazo (a venda é financiada por banco).
-- tPag 99 (outros) exige descrição no XML.
alter table fiscal_config add column if not exists indicador_pagamento text not null default '1';
alter table fiscal_config add column if not exists forma_pagamento text not null default '99';
alter table fiscal_config add column if not exists descricao_pagamento text not null default 'A prazo';

-- CFOP interestadual: só usado quando a venda NÃO é presencial. Comprador de
-- outro estado que vem à loja fez operação interna (5102).
alter table fiscal_config add column if not exists cfop_interestadual text not null default '6102';

-- Reforma tributária (IBS/CBS) — obrigatório desde 03/08/2026. Sem multa por
-- ora, por isso `ibs_cbs_ativo`: se a SEFAZ recusar o grupo, desliga por UPDATE
-- em vez de bloquear a emissão.
alter table fiscal_config add column if not exists ibs_cbs_ativo boolean not null default true;
alter table fiscal_config add column if not exists ibs_cbs_situacao_tributaria text not null default '000';
alter table fiscal_config add column if not exists ibs_cbs_classificacao_tributaria text not null default '000001';
alter table fiscal_config add column if not exists ibs_uf_aliquota numeric(6,4) not null default 0.10;
alter table fiscal_config add column if not exists ibs_mun_aliquota numeric(6,4) not null default 0;
alter table fiscal_config add column if not exists cbs_aliquota numeric(6,4) not null default 0.90;
