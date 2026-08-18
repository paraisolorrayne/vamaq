-- ============================================================================
-- VAMAQ MOTORS — devolução de veículo recebido em consignação (CFOP 5918).
--
-- Em 18/08/2026 entrou a nota de ENTRADA de consignação (CFOP 1917, da NF 14
-- autorizada). Faltou o outro lado: o carro que não vende volta para o dono, e
-- isso é uma SAÍDA com CFOP 5918 — resposta do contador Rodrigo em 14/08.
-- Sem ela, a Mayra consegue receber o carro e não consegue devolver.
--
-- `notas_fiscais.cfop` passa a ser gravado. Sem isso não há como saber se uma
-- entrada foi compra (1102) ou consignação (1917) — e é essa distinção que diz
-- quais carros podem ser devolvidos.
--
-- Aplicar:  psql "$DATABASE_URL" -f db/fiscal-consignacao-devolucao.sql
-- ============================================================================

-- O que foi efetivamente emitido. Guardado na nota, não deduzido da config:
-- a config muda com o tempo, a nota emitida não.
alter table notas_fiscais
  add column if not exists cfop text;

-- A devolução é fiscalmente uma saída, mas não é a venda: as guardas de "já
-- tem nota" são por operação, e tratá-la como 'saida' faria a devolução
-- bloquear a emissão da venda (e vice-versa) do mesmo veículo.
do $$
begin
  alter table notas_fiscais drop constraint if exists nota_operacao_check;
  alter table notas_fiscais
    add constraint nota_operacao_check
    check (operacao in ('saida','entrada','devolucao'));
end $$;

alter table fiscal_config
  add column if not exists cfop_devolucao_consignacao text default '5918',
  add column if not exists natureza_devolucao_consignacao text
    default 'devolucao de mercadoria recebida em consignacao mercantil ou industrial';
