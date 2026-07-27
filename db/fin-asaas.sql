-- ============================================================================
-- VAMAQ MOTORS — espelho de cobranças Asaas (preparação da integração).
--
-- Guarda uma cópia local das cobranças/pagamentos do Asaas (boleto/pix), para
-- conciliação e para lançar a receita automaticamente quando o cliente paga.
-- A fonte da verdade é o Asaas; aqui é espelho + vínculo com o financeiro.
--
-- Vive no schema `fin`, aplicado pela role vamaq_fin:
--   psql "$DATABASE_URL_FIN" -f db/fin-asaas.sql        (seguro re-aplicar)
-- ============================================================================

create table if not exists fin.asaas_payments (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references fin.companies(id) on delete cascade,
  asaas_id       text not null unique,          -- id da cobrança no Asaas (pay_...)
  asaas_customer text,                          -- id do cliente no Asaas (cus_...)
  contact_id     uuid references fin.contacts(id),
  transaction_id uuid references fin.transactions(id),  -- lançamento gerado ao pagar
  vehicle_id     uuid references public.vehicles(id) on delete set null,
  billing_type   text,                          -- BOLETO | PIX | CREDIT_CARD | ...
  status         text,                          -- PENDING | RECEIVED | CONFIRMED | OVERDUE ...
  value          numeric(15,2),
  net_value      numeric(15,2),
  due_date       date,
  paid_at        date,
  invoice_url    text,                          -- link da fatura/boleto
  raw            jsonb not null default '{}'::jsonb,  -- payload completo do evento
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists asaas_status_idx on fin.asaas_payments(status);
create index if not exists asaas_due_idx on fin.asaas_payments(due_date);
create index if not exists asaas_vehicle_idx on fin.asaas_payments(vehicle_id) where vehicle_id is not null;

drop trigger if exists asaas_payments_set_updated_at on fin.asaas_payments;
create trigger asaas_payments_set_updated_at before update on fin.asaas_payments
  for each row execute function fin.set_updated_at();
