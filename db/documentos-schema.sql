-- ============================================================================
-- VAMAQ MOTORS — documentos gerados (contratos) guardados para consulta.
--
-- O PDF fica em data/documentos/<ano>/<uuid>.pdf, FORA de public/, servido só
-- com login. Aqui ficam os metadados que permitem achar o documento depois.
--
-- Contrato é PROVA: apagar o veículo ou o usuário NÃO apaga o documento —
-- por isso `on delete set null` nos dois vínculos, nunca cascade.
--
-- Aplicar:  psql "$DATABASE_URL" -f db/documentos-schema.sql   (re-aplicável)
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists documentos_gerados (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null,
  titulo      text not null,
  cliente     text,                        -- a outra parte; null se não identificada
  vehicle_id  uuid references vehicles(id) on delete set null,
  arquivo     text not null,               -- caminho relativo dentro de data/documentos
  tamanho     integer,
  criado_por  uuid references users(id) on delete set null,
  created_at  timestamptz not null default now(),

  constraint documento_tipo_check
    check (tipo in ('compra-venda','venda','consignacao','termo-vistoria'))
);

create index if not exists documentos_gerados_data_idx
  on documentos_gerados(created_at desc);
create index if not exists documentos_gerados_veiculo_idx
  on documentos_gerados(vehicle_id) where vehicle_id is not null;
create index if not exists documentos_gerados_cliente_idx
  on documentos_gerados(lower(cliente));
