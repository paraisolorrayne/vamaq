-- ============================================================================
-- VAMAQ MOTORS — como o cancelamento externo foi comprovado.
--
-- O AJUSTE (24/08/2026): exigir o protocolo travava a operadora quando a
-- contabilidade confirmava por telefone ou WhatsApp sem mandar o número. E aí
-- ela parava e ligava para o suporte — que é exatamente o que este caminho
-- existe para evitar.
--
-- Sendo honesto sobre o que o protocolo faz: ele não VERIFICA nada, porque
-- ninguém confere contra a SEFAZ. Ele registra, e obriga a buscar algo
-- concreto antes de clicar. Isso vale — mas não vale bloquear quem tem a
-- confirmação e não tem o número.
--
-- Então os dois caminhos existem, e a coluna guarda QUAL deles foi usado. O
-- registro passa a dizer a verdade sobre a prova que sustentou a decisão, em
-- vez de fingir que toda baixa teve protocolo.
--
-- Aplicar:  psql "$DATABASE_URL" -f db/fiscal-cancelamento-evidencia.sql
-- ============================================================================

alter table notas_fiscais
  add column if not exists cancelamento_evidencia text,
  add column if not exists cancelamento_confirmado_por text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'nota_cancel_evidencia_check') then
    alter table notas_fiscais
      add constraint nota_cancel_evidencia_check
      check (cancelamento_evidencia is null
             or cancelamento_evidencia in ('protocolo','confirmacao'));
  end if;
end $$;

-- Baixas já feitas com protocolo ficam marcadas como tal.
update notas_fiscais
   set cancelamento_evidencia = 'protocolo'
 where cancelamento_externo
   and cancelamento_protocolo is not null
   and cancelamento_evidencia is null;
