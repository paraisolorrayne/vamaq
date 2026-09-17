-- ============================================================================
-- VAMAQ MOTORS — o ciclo do veículo chega ao financeiro.
--
-- POR QUE ISTO NÃO É SÓ RELATÓRIO: getVehicleMargins (src/lib/fin/repositories/
-- finance.js) alimenta src/lib/fiscal/notas.js, de onde sai o `custoAquisicao`
-- que vira a BASE DO ICMS da nota de venda. Num carro que voltou na troca,
-- somar os dois ciclos colocaria o custo da primeira compra na base do imposto
-- da segunda venda — erro silencioso, em nota autorizada pela SEFAZ.
--
-- Aplicar:  psql "$DATABASE_URL_FIN" -f db/fin-ciclo.sql   (re-aplicável)
-- Depende de: fin-schema.sql e db/estoque-ciclo.sql (vehicles.ciclo).
-- ============================================================================

alter table fin.transactions add column if not exists ciclo int not null default 1;

create index if not exists tx_vehicle_ciclo_idx
  on fin.transactions(vehicle_id, ciclo) where vehicle_id is not null;

-- Mesmo carimbo por trigger das notas: vehicle_id aqui é OPCIONAL (despesa da
-- loja não é de carro nenhum), por isso o `if not null` dentro da função.
--
-- É uma função PRÓPRIA, não uma chamada a `carimba_ciclo_do_veiculo()` do
-- public (db/estoque-ciclo.sql): vamaq_fin não tem CREATE em public
-- (blindagem — db/fin-blindagem.sql), só é dona do schema fin. Duplicar a
-- função é o preço de manter essa blindagem; não "limpe" isto achando que é
-- código repetido por descuido.
--
-- ⚠️ AS DUAS NASCERAM IGUAIS E HOJE SÃO DIFERENTES, DE PROPÓSITO. A de public
-- carimba `notas_fiscais` e é `before insert` só; esta carimba
-- `fin.transactions` e é `before insert or update`, com o ramo de TG_OP
-- abaixo. A divergência não é descuido nem drift: nota fiscal nasce já ligada
-- ao veículo e nenhum código faz `update notas_fiscais set vehicle_id`,
-- enquanto lançamento financeiro nasce solto e só depois é ligado ao carro
-- (updateTransaction, em src/lib/fin/repositories/finance.js). NÃO
-- re-sincronize uma pela outra: copiar a de public para cá devolve o
-- lançamento ligado depois ao ciclo 1 default, e o custo da PRIMEIRA compra
-- volta para a base do ICMS da SEGUNDA venda — que é exatamente o buraco que
-- este arquivo existe para fechar.
--
-- BEFORE INSERT OR UPDATE, não só INSERT: o fluxo normal de lançar e só
-- depois linkar o carro (updateTransaction em finance.js, que edita
-- vehicle_id livremente) insere com vehicle_id nulo — trigger de INSERT
-- sozinho nunca carimbaria, e a despesa ficaria presa no ciclo 1 default
-- mesmo linkando um carro em ciclo 2, contaminando a base do ICMS da venda
-- errada. Mas UPDATE não pode ser incondicional: reeditar o VALOR de um
-- lançamento antigo, do ciclo 1, não pode empurrá-lo pro ciclo 2 só porque o
-- carro já avançou — daí o carimbo no UPDATE só disparar quando o
-- vehicle_id realmente MUDA (e não fica nulo).
create or replace function fin.carimba_ciclo_do_veiculo() returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    if new.vehicle_id is not null then
      select v.ciclo into new.ciclo from public.vehicles v where v.id = new.vehicle_id;
    end if;
  elsif TG_OP = 'UPDATE' then
    if new.vehicle_id is not null and new.vehicle_id is distinct from old.vehicle_id then
      select v.ciclo into new.ciclo from public.vehicles v where v.id = new.vehicle_id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists transactions_carimba_ciclo on fin.transactions;
create trigger transactions_carimba_ciclo
  before insert or update on fin.transactions
  for each row execute function fin.carimba_ciclo_do_veiculo();

-- A view acompanha a agregação da função, para as duas não divergirem no dia
-- em que alguém finalmente ler a view.
--
-- CONTRATO para quem casa por (vehicle_id, ciclo): o `coalesce(t.ciclo,
-- v.ciclo)` só produz uma linha "vazia" no ciclo corrente quando o LEFT JOIN
-- não encontra NENHUM lançamento do veículo em NENHUM ciclo; um carro que
-- voltou na troca e já tem lançamentos do ciclo 1 fechado, mas nenhum ainda
-- no ciclo 2 aberto, aparece só com a linha do ciclo 1 — sem linha alguma
-- para o ciclo_atual. Quem casa por (vehicle_id, ciclo_atual) — Tasks 5 e 6 —
-- tem que tratar essa ausência, não assumir que ela sempre existe.
--
-- ciclo/ciclo_atual vão no FIM da lista de colunas, não depois de vehicle_id:
-- `create or replace view` só permite ACRESCENTAR colunas no final (mudar a
-- posição de uma coluna já existente é erro do Postgres — 42P16, "cannot
-- change name of view column"). Mesma regra já registrada em fin-blindagem.sql
-- para a `placa` de fin.v_vehicles.
create or replace view fin.v_vehicle_margin as
  select
    v.id as vehicle_id,
    v.brand, v.model, v.year, v.placa, v.status,
    coalesce(sum(t.amount) filter (where t.type = 'revenue'), 0) as receita,
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0) as custo_total,
    coalesce(sum(t.amount) filter (where t.type = 'revenue'), 0)
      - coalesce(sum(t.amount) filter (where t.type = 'expense'), 0) as resultado,
    coalesce(t.ciclo, v.ciclo) as ciclo,
    v.ciclo as ciclo_atual
  from public.vehicles v
  left join fin.transactions t
    on t.vehicle_id = v.id and t.status in ('confirmed', 'reconciled')
  group by v.id, v.brand, v.model, v.year, v.placa, v.status,
           coalesce(t.ciclo, v.ciclo), v.ciclo;
