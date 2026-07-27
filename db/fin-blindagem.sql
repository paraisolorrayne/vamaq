-- ============================================================================
-- VAMAQ MOTORS — blindagem do estoque (PR-C do ADR-002).
--
-- Garante NO BANCO que o módulo financeiro (role `vamaq_fin`) só LÊ o estoque,
-- nunca escreve. `public.vehicles` continua sendo a fonte única; o financeiro
-- consome pela view `fin.v_vehicles`. Assim, mesmo que um código futuro tente
-- escrever num veículo pela conexão do financeiro, o Postgres recusa.
--
-- PRÉ-REQUISITO: a role `vamaq_fin` já existe (criada por scripts/setup-fin-role.sh,
-- que gera a senha e grava DATABASE_URL_FIN). Este arquivo só define schema,
-- view e permissões — sem senha, seguro no git. Idempotente.
--
-- Aplicar (como superusuário, após criar a role):
--   sudo -u postgres psql -d vamaq -f db/fin-blindagem.sql
-- ============================================================================

-- schema do financeiro (as tabelas fin.* chegam no PR-1)
create schema if not exists fin;
alter schema fin owner to vamaq_fin;

-- View de leitura do estoque: fonte única = public.vehicles. É por aqui que o
-- financeiro lê o veículo (para margem por carro etc.).
create or replace view fin.v_vehicles as
  select id, slug, brand, model, year, price, quilometragem,
         status, published, created_at, updated_at
  from public.vehicles;

-- Permissões do financeiro:
grant usage on schema public to vamaq_fin;       -- enxergar o schema public
grant select on public.vehicles to vamaq_fin;    -- só LEITURA do estoque
grant select on fin.v_vehicles to vamaq_fin;

-- Trava explícita de escrita no core (defense-in-depth — uma role não-dona já
-- não teria escrita, mas deixamos a intenção registrada e à prova de GRANT
-- acidental futuro).
revoke insert, update, delete, truncate on public.vehicles from vamaq_fin;

-- Garante que o financeiro NÃO ganhe escrita em public por default privileges.
alter default privileges in schema public revoke insert, update, delete on tables from vamaq_fin;
