-- ============================================================================
-- VAMAQ MOTORS — CFOP de entrada e devolução quando a outra parte é de fora.
--
-- O BUG (22/08/2026): a NF 17 entrou um Audi Q5 recebido em consignação de um
-- cliente de Catalão/GO com CFOP **1917**. O correto é **2917** — confirmado
-- pelo contador. A família 1xxx é para operação DENTRO do estado; a 2xxx é
-- interestadual. A nota foi autorizada errada e precisou ser cancelada.
--
-- A entrada já nascia com `local_destino: 1` fixo e um CFOP só. Só a venda
-- tinha o par (5102 / 6102).
--
-- REGRA DIFERENTE DA VENDA, DE PROPÓSITO: na venda o CFOP só vira 6102 quando
-- a operação NÃO é presencial — comprador de outro estado que vem à loja e
-- leva o carro fez operação interna, o fato gerador foi em MG (contador,
-- 14/08). Na ENTRADA não há essa exceção: a mercadoria veio fisicamente de
-- outra UF, e é a origem dela que define a operação.
--
-- Aplicar:  psql "$DATABASE_URL" -f db/fiscal-cfop-interestadual.sql
-- ============================================================================

alter table fiscal_config
  add column if not exists cfop_entrada_interestadual text default '2102',
  add column if not exists cfop_entrada_consignacao_interestadual text default '2917',
  add column if not exists cfop_devolucao_consignacao_interestadual text default '6918',
  -- A natureza acompanha: nota com CFOP 6102 dizendo "Venda Dentro do Estado"
  -- se contradiz na própria cara da DANFE.
  add column if not exists natureza_interestadual text default 'Venda Fora do Estado',
  add column if not exists natureza_entrada_interestadual text default 'Compra Fora do Estado';

-- Preenche onde a linha já existe e a coluna acabou de nascer nula.
update fiscal_config set
  cfop_entrada_interestadual = coalesce(cfop_entrada_interestadual, '2102'),
  cfop_entrada_consignacao_interestadual = coalesce(cfop_entrada_consignacao_interestadual, '2917'),
  cfop_devolucao_consignacao_interestadual = coalesce(cfop_devolucao_consignacao_interestadual, '6918'),
  natureza_interestadual = coalesce(natureza_interestadual, 'Venda Fora do Estado'),
  natureza_entrada_interestadual = coalesce(natureza_entrada_interestadual, 'Compra Fora do Estado');
