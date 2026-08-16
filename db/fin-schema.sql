-- ============================================================================
-- VAMAQ MOTORS — schema do núcleo financeiro (PR-1 do ADR-002).
--
-- Vive no schema `fin`, separado de `public` (estoque/site). É APLICADO E
-- ESCRITO pela role `vamaq_fin` (DATABASE_URL_FIN), que só LÊ public.vehicles —
-- a blindagem do estoque (db/fin-blindagem.sql) garante isso no banco.
--
-- Núcleo (recorte ADR-001a §6): companies, chart_of_accounts, cost_centers,
-- bank_accounts, contacts, transactions (+ vehicle_id → estoque) e a view de
-- margem. Single-tenant: uma única row em companies (mantém company_id no
-- schema para reabrir multi-loja no futuro, custo zero).
--
-- Regras de negócio: ADR-001c §1. Sem RLS (autorização é na aplicação).
--
-- Aplicar (como vamaq_fin, dona do schema fin):
--   psql "$DATABASE_URL_FIN" -f db/fin-schema.sql        (seguro re-aplicar)
--
-- O schema `fin` já existe (criado por db/fin-blindagem.sql / setup-fin-role.sh
-- como superusuário e cedido à role vamaq_fin). Aqui só criamos as tabelas
-- dentro dele — vamaq_fin é dona do schema, então pode criar sem CREATE no db.
-- ============================================================================

-- Empresa (single-tenant: 1 row = Vamaq). regime_tributario alimenta o fiscal.
create table if not exists fin.companies (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  cnpj               text unique,
  regime_tributario  text not null default 'lucro_presumido',
  inscricao_estadual  text,
  inscricao_municipal text,
  -- ICMS do seminovo: base = lucro (venda − compra), alíquota 5% (contador Rodrigo).
  icms_seminovo_aliquota numeric(5,2) not null default 5,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table fin.companies add column if not exists inscricao_estadual text;
alter table fin.companies add column if not exists inscricao_municipal text;
alter table fin.companies add column if not exists icms_seminovo_aliquota numeric(5,2) not null default 5;

-- Dados fiscais da Vamaq (idempotente).
update fin.companies
   set inscricao_estadual = '005480333.00-93',
       inscricao_municipal = '737.533-00',
       regime_tributario = 'lucro_presumido',
       icms_seminovo_aliquota = 5
 where cnpj = '45.348.469/0001-54';

-- Plano de contas (hierárquico opcional via parent_id; o DRE usa o code:
-- receita = type revenue; CMV = expense com code começando em 4; despesa
-- operacional = expense com o restante). editable=false protege o seed padrão.
create table if not exists fin.chart_of_accounts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references fin.companies(id) on delete cascade,
  parent_id   uuid references fin.chart_of_accounts(id),
  code        text,
  name        text not null,
  type        text not null default 'expense',
  editable    boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint coa_type_check check (type in ('revenue', 'expense'))
);
create index if not exists coa_company_idx on fin.chart_of_accounts(company_id);

create table if not exists fin.cost_centers (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references fin.companies(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists cc_company_idx on fin.cost_centers(company_id);

create table if not exists fin.bank_accounts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references fin.companies(id) on delete cascade,
  name        text not null,
  bank_name   text,
  created_at  timestamptz not null default now()
);
create index if not exists ba_company_idx on fin.bank_accounts(company_id);

-- Contatos: clientes e fornecedores do financeiro.
create table if not exists fin.contacts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references fin.companies(id) on delete cascade,
  name        text not null,
  doc         text,                       -- CPF/CNPJ
  kind        text not null default 'ambos',
  email       text,
  phone       text,
  created_at  timestamptz not null default now(),
  constraint contact_kind_check check (kind in ('cliente', 'fornecedor', 'ambos'))
);
create index if not exists contact_company_idx on fin.contacts(company_id);

-- Lançamentos. vehicle_id liga ao estoque (fonte única) → margem por veículo.
-- ON DELETE RESTRICT: veículo com lançamento não é apagado (preserva histórico).
create table if not exists fin.transactions (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references fin.companies(id) on delete cascade,
  date            date not null,
  description     text not null,
  amount          numeric(15,2) not null,
  type            text not null,
  account_id      uuid references fin.chart_of_accounts(id),
  cost_center_id  uuid references fin.cost_centers(id),
  bank_account_id uuid references fin.bank_accounts(id),
  contact_id      uuid references fin.contacts(id),
  vehicle_id      uuid references public.vehicles(id) on delete restrict,
  status          text not null default 'confirmed',
  source          text not null default 'manual',
  external_id     text,
  created_by      uuid,                    -- public.users(id) (sem FK cross-schema)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint tx_type_check check (type in ('revenue', 'expense')),
  constraint tx_status_check check (status in ('pending', 'confirmed', 'reconciled')),
  constraint tx_source_check check (source in ('manual', 'whatsapp', 'bank', 'import'))
);
create index if not exists tx_company_date_idx on fin.transactions(company_id, date desc);
create index if not exists tx_account_idx on fin.transactions(account_id);
create index if not exists tx_vehicle_idx on fin.transactions(vehicle_id) where vehicle_id is not null;
-- Idempotência de integrações (ADR-001c §1): dedup por origem+external_id.
create unique index if not exists tx_external_uniq
  on fin.transactions(company_id, source, external_id) where external_id is not null;

-- Contas a pagar (com alçada de aprovação — ADR-001c §2).
-- Dois eixos independentes: approval_status (fluxo de aprovação) e o "status"
-- de pagamento (pago/a vencer/vencido) calculado a partir de paid_at + due_date.
-- Aprovar NÃO paga; pagar NÃO gera lançamento (é uma ilha, como no original).
create table if not exists fin.bills_payable (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references fin.companies(id) on delete cascade,
  description     text not null,
  value           numeric(15,2) not null,
  due_date        date not null,
  contact_id      uuid references fin.contacts(id),
  account_id      uuid references fin.chart_of_accounts(id),
  cost_center_id  uuid references fin.cost_centers(id),
  approval_status text not null default 'approved',
  created_by      uuid,
  approved_by     uuid,
  approved_at     timestamptz,
  paid_at         date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint bp_approval_check check (approval_status in ('awaiting_approval','approved','rejected'))
);
create index if not exists bp_company_due_idx on fin.bills_payable(company_id, due_date);
create index if not exists bp_approval_idx on fin.bills_payable(approval_status);

-- Fechamento mensal (marco gerencial soft — ADR-001c §1). Não trava lançamentos
-- retroativos; guarda um retrato (snapshot) do resultado do mês fechado.
create table if not exists fin.monthly_close (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references fin.companies(id) on delete cascade,
  ano         integer not null,
  mes         integer not null,
  snapshot    jsonb not null default '{}'::jsonb,
  closed_by   uuid,
  closed_at   timestamptz not null default now(),
  unique (company_id, ano, mes),
  constraint mc_mes_check check (mes between 1 and 12)
);

-- Orçamento: metas mensais de receita/custo/despesa (comparadas com o realizado).
create table if not exists fin.budgets (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references fin.companies(id) on delete cascade,
  ano           integer not null,
  mes           integer not null,
  receita_meta  numeric(15,2) not null default 0,
  custo_meta    numeric(15,2) not null default 0,
  despesa_meta  numeric(15,2) not null default 0,
  unique (company_id, ano, mes),
  constraint bud_mes_check check (mes between 1 and 12)
);

-- updated_at automático
create or replace function fin.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists companies_set_updated_at on fin.companies;
create trigger companies_set_updated_at before update on fin.companies
  for each row execute function fin.set_updated_at();
drop trigger if exists transactions_set_updated_at on fin.transactions;
create trigger transactions_set_updated_at before update on fin.transactions
  for each row execute function fin.set_updated_at();
drop trigger if exists bills_set_updated_at on fin.bills_payable;
create trigger bills_set_updated_at before update on fin.bills_payable
  for each row execute function fin.set_updated_at();

-- View de margem por veículo: junta lançamentos confirmados ao estoque.
-- receita − custo (CMV, code 4x) = lucro bruto por carro. Só confirmados.
create or replace view fin.v_vehicle_margin as
  select
    v.id as vehicle_id,
    v.brand, v.model, v.year, v.placa, v.status,
    coalesce(sum(t.amount) filter (where t.type = 'revenue'), 0) as receita,
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0) as custo_total,
    coalesce(sum(t.amount) filter (where t.type = 'revenue'), 0)
      - coalesce(sum(t.amount) filter (where t.type = 'expense'), 0) as resultado
  from public.vehicles v
  left join fin.transactions t
    on t.vehicle_id = v.id and t.status in ('confirmed', 'reconciled')
  group by v.id, v.brand, v.model, v.year, v.placa, v.status;

-- ============================================================================
-- Seed idempotente: empresa Vamaq + plano de contas de concessionária +
-- centros de custo. Só roda se ainda não houver empresa.
-- ============================================================================
do $$
declare
  v_company uuid;
begin
  select id into v_company from fin.companies limit 1;
  if v_company is null then
    insert into fin.companies (name, cnpj, regime_tributario)
      values ('Vamaq Motors', '45.348.469/0001-54', 'lucro_presumido')
      returning id into v_company;

    -- Plano de contas adaptado a concessionária (editable=false)
    insert into fin.chart_of_accounts (company_id, code, name, type, editable) values
      -- Receitas (3.x)
      (v_company, '3.1', 'Venda de Veículos', 'revenue', false),
      (v_company, '3.2', 'Serviços e Documentação', 'revenue', false),
      (v_company, '3.3', 'Comissão de Consignação', 'revenue', false),
      (v_company, '3.4', 'Outras Receitas', 'revenue', false),
      -- Custos / CMV (4.x — entram como custo no DRE)
      (v_company, '4.1', 'Custo de Aquisição de Veículos', 'expense', false),
      (v_company, '4.2', 'Preparação e Reparos', 'expense', false),
      (v_company, '4.3', 'Documentação e Transferência', 'expense', false),
      -- Despesas operacionais — Administrativas (5.1.x)
      (v_company, '5.1.1', 'Pró-labore', 'expense', false),
      (v_company, '5.1.2', 'Salários e Encargos', 'expense', false),
      (v_company, '5.1.3', 'Contabilidade', 'expense', false),
      (v_company, '5.1.4', 'Aluguel', 'expense', false),
      (v_company, '5.1.5', 'Água / Energia / Internet', 'expense', false),
      (v_company, '5.1.6', 'Softwares e Sistemas', 'expense', false),
      -- Comerciais (5.2.x)
      (v_company, '5.2.1', 'Marketing', 'expense', false),
      (v_company, '5.2.2', 'Tráfego Pago', 'expense', false),
      (v_company, '5.2.3', 'Comissão de Vendas', 'expense', false),
      -- Financeiras (5.3.x)
      (v_company, '5.3.1', 'Juros e Tarifas Bancárias', 'expense', false),
      (v_company, '5.3.2', 'Taxas de Cartão / Maquininha', 'expense', false),
      -- Impostos (5.4.x)
      (v_company, '5.4.1', 'Impostos sobre Vendas', 'expense', false);

    insert into fin.cost_centers (company_id, name) values
      (v_company, 'Administrativo'),
      (v_company, 'Comercial'),
      (v_company, 'Financeiro'),
      (v_company, 'Operacional / Pátio');
  end if;
end $$;

-- ============================================================================
-- Categorias personalizadas do plano de contas (14/08/2026).
--
-- O seed acima só roda em banco vazio (`if v_company is null`), então tudo que
-- vier depois precisa do próprio bloco idempotente — em produção a empresa já
-- existe há meses.
--
-- `ativo`: categoria errada NÃO se apaga. Ela fica nos lançamentos que já
-- aconteceram, e apagar quebraria o histórico (ou a FK). Desativar tira da
-- lista de escolha e preserva o passado.
-- ============================================================================
alter table fin.chart_of_accounts add column if not exists ativo boolean not null default true;

-- As sete categorias que a Mayra pediu em 14/08/2026, pelo nome que ela usa.
-- Lava jato e chaveiro entram em 4.2 (custo do veículo), não em despesa
-- administrativa: são gastos de um carro específico e precisam pesar na margem
-- daquele carro quando o lançamento for ligado a ele.
do $$
declare
  v_company uuid;
  v_conta record;
begin
  select id into v_company from fin.companies limit 1;
  if v_company is null then return; end if;

  for v_conta in
    select * from (values
      ('4.2.1',  'Lava Jato',                     'expense'),
      ('4.2.2',  'Chaveiro',                      'expense'),
      ('5.1.7',  'Material de Escritório',        'expense'),
      ('5.1.8',  'Material de Limpeza',           'expense'),
      ('5.1.9',  'Alimentação',                   'expense'),
      ('5.1.10', 'Tonner / Manutenção de Impressora', 'expense'),
      ('5.2.4',  'Brindes',                       'expense')
    ) as t(code, name, type)
  loop
    -- Casa por CÓDIGO: reaplicar o schema não pode duplicar a conta, e renomear
    -- pela tela não pode fazer a linha voltar na próxima aplicação.
    if not exists (
      select 1 from fin.chart_of_accounts
       where company_id = v_company and code = v_conta.code
    ) then
      insert into fin.chart_of_accounts (company_id, code, name, type, editable)
        values (v_company, v_conta.code, v_conta.name, v_conta.type, true);
    end if;
  end loop;
end $$;

-- ============================================================================
-- Contas recorrentes e comprovante anexado (15/08/2026).
--
-- `serie_id` liga as parcelas de uma mesma conta mensal (água, luz, internet).
-- A série é gerada na hora, com todas as parcelas visíveis — não há tarefa
-- agendada criando conta de madrugada, porque agendador que falha, falha
-- calado, e ninguém descobre até a conta vencer.
--
-- `linha_digitavel` guarda os números lidos do boleto/conta: é o que permite
-- conferir o valor depois e repetir o pagamento sem procurar o papel.
-- `anexo` guarda os metadados do arquivo; o arquivo em si fica em disco
-- privado (data/contas/), servido só com login, igual aos documentos do
-- veículo.
-- ============================================================================
alter table fin.bills_payable add column if not exists serie_id uuid;
alter table fin.bills_payable add column if not exists serie_total integer;
alter table fin.bills_payable add column if not exists linha_digitavel text;
alter table fin.bills_payable add column if not exists anexo jsonb;

create index if not exists bills_payable_serie_idx on fin.bills_payable(serie_id);
