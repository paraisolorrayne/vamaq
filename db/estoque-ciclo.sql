-- ============================================================================
-- VAMAQ MOTORS — ciclo de vida do veículo (compra → venda → retorno).
--
-- POR QUE ISTO EXISTE: o carro que a Vamaq vende e recebe de VOLTA numa troca
-- é uma nova aquisição — nota de entrada própria, custo próprio, e a próxima
-- nota de venda cita ESSA entrada. Sem um número de ciclo, o sistema assume
-- que uma linha de `vehicles` é UM ciclo: as guardas de notas_fiscais barram a
-- segunda nota de entrada e a segunda de saída do mesmo vehicle_id, e o único
-- caminho sobra recadastrar o carro (Mayra, 17/09/2026).
--
-- O `default 1` é o que torna isto retrocompatível: todo carro e toda nota que
-- existem hoje ficam no ciclo 1, e as guardas passam a comparar 1 = 1.
--
-- Ver docs/superpowers/specs/2026-09-17-retorno-ao-estoque-design.md
--
-- Aplicar:  psql "$DATABASE_URL" -f db/estoque-ciclo.sql   (re-aplicável)
-- Depende de: schema.sql (vehicles), auth-schema.sql (users),
--             fiscal-schema.sql (notas_fiscais) e fiscal-entrada.sql (coluna
--             `operacao` — o índice da guarda por ciclo é sobre
--             vehicle_id + operacao + ciclo, e `operacao` só existe depois de
--             fiscal-entrada.sql)
-- ============================================================================

alter table vehicles      add column if not exists ciclo int not null default 1;
alter table notas_fiscais add column if not exists ciclo int not null default 1;

-- A guarda "este veículo já tem nota desta operação" passa a ser por ciclo.
create index if not exists notas_fiscais_veiculo_operacao_ciclo_idx
  on notas_fiscais(vehicle_id, operacao, ciclo);

-- Os ciclos JÁ ENCERRADOS. O corrente vive nas colunas de `vehicles`
-- (data_entrada/data_saida), que são uma só de cada — sem esta tabela, abrir o
-- ciclo 2 sobrescreveria a compra original e ela sumiria do relatório de
-- entradas e saídas.
create table if not exists vehicle_ciclos (
  id            uuid primary key default gen_random_uuid(),
  vehicle_id    uuid not null references vehicles(id) on delete cascade,
  ciclo         int  not null,
  data_entrada  date,
  data_saida    date,
  price         numeric(12,2),
  encerrado_em  timestamptz not null default now(),
  encerrado_por uuid references users(id),
  unique (vehicle_id, ciclo)
);

create index if not exists vehicle_ciclos_vehicle_idx on vehicle_ciclos(vehicle_id);

-- O carimbo do ciclo é TRIGGER, não código de aplicação. Hoje são três pontos
-- de inserção de nota (src/lib/fiscal/notas.js) e dois de lançamento; com
-- trigger, nenhum deles pode esquecer — nem os que forem escritos depois.
-- Mesma razão pela qual data_saida é carimbada no update de status, e não
-- pedida à operadora.
create or replace function carimba_ciclo_do_veiculo() returns trigger as $$
begin
  if new.vehicle_id is not null then
    select v.ciclo into new.ciclo from vehicles v where v.id = new.vehicle_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists notas_fiscais_carimba_ciclo on notas_fiscais;
create trigger notas_fiscais_carimba_ciclo
  before insert on notas_fiscais
  for each row execute function carimba_ciclo_do_veiculo();
