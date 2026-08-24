-- ============================================================================
-- VAMAQ MOTORS — carta de correção eletrônica (CC-e) na nota.
--
-- POR QUE (23/08/2026): a NF 17 saiu com CFOP errado e o prazo de 24 horas
-- para cancelar venceu — o escritório não tem expediente no fim de semana.
-- Sem CC-e, a única saída seria emitir uma contra-nota.
--
-- A CC-e não é só para este caso: qualquer nota autorizada com erro em campo
-- que NÃO determina imposto (endereço, descrição, natureza da operação) se
-- corrige por aqui, e o sistema não tinha resposta nenhuma para isso.
--
-- Guarda o ÚLTIMO texto enviado: a SEFAZ aceita até 20 correções por nota e
-- vale sempre a última. Guardar todas daria a impressão de que as anteriores
-- ainda valem.
--
-- Aplicar:  psql "$DATABASE_URL" -f db/fiscal-carta-correcao.sql
-- ============================================================================

alter table notas_fiscais
  add column if not exists carta_correcao text,
  add column if not exists carta_correcao_em timestamptz,
  add column if not exists carta_correcao_qtd integer not null default 0;
