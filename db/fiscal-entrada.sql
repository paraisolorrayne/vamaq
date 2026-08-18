-- ============================================================================
-- VAMAQ MOTORS — nota fiscal de ENTRADA (compra de pessoa física).
--
-- POR QUE ISTO EXISTE: o texto obrigatório da nota de VENDA cita o número da
-- nota de ENTRADA do veículo ("VEICULO USADO ADQ DE ... CF NF 10"). Sem a
-- entrada emitida, a venda não sai. Hoje a entrada depende do escritório, e é
-- por isso que os carros acumulam esperando nota — o gargalo não é a venda, é
-- o que vem antes dela.
--
-- SÓ COMPRA DE PESSOA FÍSICA. Comprando de PJ, quem emite é a PJ (é
-- contribuinte e emite a própria nota de venda); a Vamaq recebe e escritura.
-- Emitir aqui também colocaria duas notas na mesma compra.
--
-- Os parâmetros vêm das DANFEs 14 e 15 da própria Vamaq, autorizadas pela
-- SEFAZ-MG (docs/superpowers/specs/2026-08-12-parametros-nfe-reais.md) — não de
-- interpretação de legislação.
--
-- Aplicar:  psql "$DATABASE_URL" -f db/fiscal-entrada.sql   (re-aplicável)
-- ============================================================================

-- Um veículo tem uma nota de entrada E uma de saída. Sem distinguir, a guarda
-- "este veículo já tem nota" bloquearia a venda do carro cuja entrada acabou
-- de ser emitida.
alter table notas_fiscais
  add column if not exists operacao text not null default 'saida';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'nota_operacao_check') then
    alter table notas_fiscais
      add constraint nota_operacao_check check (operacao in ('saida','entrada'));
  end if;
end $$;

create index if not exists notas_fiscais_veiculo_operacao_idx
  on notas_fiscais(vehicle_id, operacao);

-- Parâmetros da entrada. Nenhum é inventado: os valores default abaixo são os
-- que estão nas notas 14 e 15 autorizadas.
alter table fiscal_config
  -- NF 15 — entrada por compra, dentro do estado.
  add column if not exists cfop_entrada text default '1102',
  add column if not exists natureza_entrada text default 'Compra Dentro do Estado',
  -- NF 14 — entrada de veículo recebido em consignação.
  add column if not exists cfop_entrada_consignacao text default '1917',
  add column if not exists natureza_entrada_consignacao text
    default 'entrada de mercadoria recebida em consignacao mercantil ou industrial',
  -- CST 041 nas duas (origem 0 + CST 41 = não tributada). ICMS, PIS e COFINS
  -- saem zerados: quem vendeu é pessoa física, não há imposto a destacar.
  add column if not exists cst_entrada text default '041',
  -- Confirmado pela Lorrayne em 18/08/2026: na entrada o frete continua 1,
  -- diferente da saída, que o contador corrigiu para 9 em 14/08.
  add column if not exists modalidade_frete_entrada text default '1',
  -- IBS/CBS na entrada: DESLIGADO até o contador confirmar. As notas 14 e 15
  -- são anteriores a 03/08/2026 e não respondem. A leitura provável é que não
  -- há destaque (quem vende é pessoa física, não contribuinte), mas dedução
  -- minha sobre imposto já saiu errada neste projeto — por isso é um
  -- parâmetro, que liga por UPDATE sem tocar em código.
  add column if not exists ibs_cbs_entrada_ativo boolean not null default false;
