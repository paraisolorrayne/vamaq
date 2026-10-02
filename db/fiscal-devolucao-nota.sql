-- ============================================================================
-- VAMAQ MOTORS — devolução de nota autorizada (venda 1202 / compra 5202).
--
-- O CASO (02/10/2026): o valor mudou na negociação depois de emitidas duas
-- notas de agosto. Agosto já foi apurado e pago — não cabe cancelamento. O
-- contador: nota de devolução, e depois a nota nova com o valor certo.
--
-- A devolução é `operacao = 'devolucao'`, como a de consignação. O que a
-- distingue é saber QUAL nota ela devolve:
--
--   chave_referenciada  a chave (44 dígitos) da nota devolvida — sempre, mesmo
--                       quando a original é do escritório e não está aqui.
--   ref_devolvida       a nota do sistema que foi devolvida, quando é nossa.
--                       É ela que libera o carro: nota com devolução viva
--                       deixa de contar como "o veículo já tem nota".
--
-- Aplicar:  psql "$DATABASE_URL" -f db/fiscal-devolucao-nota.sql   (re-aplicável)
-- ============================================================================

alter table notas_fiscais
  add column if not exists chave_referenciada text,
  add column if not exists ref_devolvida text references notas_fiscais(ref);

create index if not exists notas_fiscais_ref_devolvida_idx
  on notas_fiscais(ref_devolvida) where ref_devolvida is not null;
create index if not exists notas_fiscais_chave_referenciada_idx
  on notas_fiscais(chave_referenciada) where chave_referenciada is not null;
