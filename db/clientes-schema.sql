-- ============================================================================
-- VAMAQ MOTORS — cadastro de clientes e o vínculo com os veículos.
--
-- Fica no schema `public`, NÃO em `fin`: o schema financeiro roda com role e
-- pool próprios (DATABASE_URL_FIN) e é invisível para o pool do app, então
-- contrato, CRM e fiscal não conseguiriam ler fin.contacts. A listagem de
-- Contatos do financeiro segue existindo e não é tocada por este arquivo.
--
-- Aplicar:  psql "$DATABASE_URL" -f db/clientes-schema.sql   (re-aplicável)
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists clientes (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,
  tipo                text not null default 'pf',
  doc                 text,              -- SÓ DÍGITOS: CPF (11) ou CNPJ (14)
  rg                  text,
  cnh                 text,
  cnh_categoria       text,
  email               text,
  telefone            text,
  cep                 text,
  logradouro          text,
  numero              text,
  complemento         text,
  bairro              text,
  municipio           text,
  uf                  text,
  representante_nome  text,              -- só faz sentido em PJ
  representante_cpf   text,
  obs                 text,
  ativo               boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint cliente_tipo_check check (tipo in ('pf','pj'))
);

-- Dois clientes não podem ter o mesmo documento, mas cliente SEM documento é
-- permitido (é comum cadastrar pelo nome antes de ter o RG na mão) — daí o
-- índice único ser parcial.
create unique index if not exists clientes_doc_key
  on clientes(doc) where doc is not null and doc <> '';

create index if not exists clientes_nome_idx on clientes(lower(nome));

create table if not exists cliente_veiculos (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references clientes(id) on delete cascade,
  vehicle_id    uuid not null references vehicles(id) on delete cascade,
  papel         text not null,
  data          date,
  origem        text not null default 'manual',
  -- de qual contrato o vínculo nasceu; `set null` porque apagar o documento
  -- não pode apagar o fato de que a pessoa comprou o carro.
  documento_id  uuid references documentos_gerados(id) on delete set null,
  obs           text,
  created_at    timestamptz not null default now(),

  constraint cliente_veiculo_papel_check check (papel in ('comprou','vendeu','consignou')),
  -- 'crm' foi adicionado depois; o check abaixo é o que vale para banco NOVO.
  -- Bancos que já rodaram este arquivo antes têm a tabela criada e o
  -- `create table if not exists` é um no-op nela, então o check original
  -- (sem 'crm') continuaria valendo — daí o bloco `do $$` logo depois, que
  -- dropa e recria a constraint para esses bancos existentes. Não é
  -- duplicação: são os dois caminhos (banco novo x banco existente) que
  -- precisam chegar ao mesmo resultado.
  constraint cliente_veiculo_origem_check check (origem in ('manual','contrato','nota','crm'))
);

-- Gerar o mesmo contrato duas vezes não pode criar dois vínculos iguais.
create unique index if not exists cliente_veiculos_unico
  on cliente_veiculos(cliente_id, vehicle_id, papel);

create index if not exists cliente_veiculos_vehicle_idx on cliente_veiculos(vehicle_id);

-- Recria o check de origem para aceitar 'crm' em bancos que já tinham a
-- tabela cliente_veiculos criada (ver comentário no `create table` acima:
-- `create table if not exists` não muda a definição de uma tabela existente,
-- então sem isto o CRM não conseguiria gravar vínculo nenhum em produção).
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'cliente_veiculo_origem_check') then
    alter table cliente_veiculos drop constraint cliente_veiculo_origem_check;
  end if;
  alter table cliente_veiculos add constraint cliente_veiculo_origem_check
    check (origem in ('manual','contrato','nota','crm'));
end $$;

-- Ligação dos registros que já existiam. `set null` nos dois: apagar o cadastro
-- do cliente não pode apagar o contrato nem a nota, que são prova.
alter table documentos_gerados add column if not exists cliente_id uuid;
alter table notas_fiscais      add column if not exists cliente_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'documentos_gerados_cliente_fk') then
    alter table documentos_gerados
      add constraint documentos_gerados_cliente_fk
      foreign key (cliente_id) references clientes(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notas_fiscais_cliente_fk') then
    alter table notas_fiscais
      add constraint notas_fiscais_cliente_fk
      foreign key (cliente_id) references clientes(id) on delete set null;
  end if;
end $$;

-- Nome diferente de propósito: `documentos-schema.sql` já registra o índice
-- `documentos_gerados_cliente_idx` (em lower(cliente), o nome em texto livre).
-- Reusar esse nome aqui faria o `create index if not exists` virar um no-op
-- silencioso e a coluna `cliente_id` ficaria sem índice nenhum.
create index if not exists documentos_gerados_cliente_id_idx on documentos_gerados(cliente_id);
create index if not exists notas_fiscais_cliente_idx on notas_fiscais(cliente_id);
