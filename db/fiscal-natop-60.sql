-- ============================================================================
-- VAMAQ MOTORS — natureza da operação dentro do limite da NF-e.
--
-- O BUG (22/08/2026): a Mayra emitiu uma nota de consignação e a SEFAZ recusou
-- com `natOp: [facet 'maxLength'] The value has a length of '69'; this exceeds
-- the allowed maximum length of '60'`.
--
-- A ORIGEM: os textos vieram da DESCRIÇÃO OFICIAL DO CFOP ("entrada de
-- mercadoria recebida em consignacao mercantil ou industrial", 69 caracteres).
-- Essa descrição é da tabela de CFOP; `natOp` é campo livre da nota, limitado
-- a 60. Copiar um no outro estourou o limite.
--
-- A devolução (71 caracteres) tinha o mesmo defeito e nunca chegou a ser
-- usada — teria falhado igual na primeira tentativa.
--
-- Aplicar:  psql "$DATABASE_URL" -f db/fiscal-natop-60.sql   (re-aplicável)
-- ============================================================================

update fiscal_config
   set natureza_entrada_consignacao = 'Entrada de mercadoria em consignacao mercantil'
 where natureza_entrada_consignacao is null
    or length(natureza_entrada_consignacao) > 60;

update fiscal_config
   set natureza_devolucao_consignacao = 'Devolucao de mercadoria em consignacao mercantil'
 where natureza_devolucao_consignacao is null
    or length(natureza_devolucao_consignacao) > 60;

-- Os defaults das colunas também carregavam o texto longo: veículo cadastrado
-- numa base nova nasceria com o mesmo erro.
alter table fiscal_config
  alter column natureza_entrada_consignacao
  set default 'Entrada de mercadoria em consignacao mercantil';

alter table fiscal_config
  alter column natureza_devolucao_consignacao
  set default 'Devolucao de mercadoria em consignacao mercantil';
