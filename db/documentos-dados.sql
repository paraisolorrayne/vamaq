-- ============================================================================
-- VAMAQ MOTORS — guardar o que foi DIGITADO no contrato, não só o PDF.
--
-- O PROBLEMA (Mayra, 18/08/2026): ela gerou um contrato, descobriu que a
-- informação da chave reserva estava errada e teve que preencher a minuta
-- inteira de novo — trinta e poucos campos, incluindo chassi e RENAVAM, que
-- são justamente os que não se pode errar. O PDF era guardado; o que ela
-- digitou, não.
--
-- `dados` guarda os campos do formulário, para o contrato poder ser reaberto,
-- corrigido e gerado de novo.
--
-- CONTÉM DADO PESSOAL: nome, CPF, CNH e endereço das partes. É a mesma
-- natureza do que já vive em `clientes` e dentro do próprio PDF, e o acesso é
-- o mesmo da tabela (só com login, papéis vendedor/secretaria).
--
-- `corrige_documento_id` liga a versão nova à antiga. Nada é apagado: o
-- contrato continua sendo prova, e uma correção é um documento novo que diz
-- qual substituiu — não uma edição por cima do que já foi impresso ou enviado
-- para assinatura.
--
-- Aplicar:  psql "$DATABASE_URL" -f db/documentos-dados.sql   (re-aplicável)
-- ============================================================================

alter table documentos_gerados
  add column if not exists dados jsonb;

alter table documentos_gerados
  add column if not exists corrige_documento_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'documentos_gerados_corrige_fk'
  ) then
    alter table documentos_gerados
      add constraint documentos_gerados_corrige_fk
      foreign key (corrige_documento_id)
      references documentos_gerados(id)
      -- set null, nunca cascade: se o original sumisse, a correção continua
      -- valendo por si — ela é o contrato que vale.
      on delete set null;
  end if;
end $$;

create index if not exists documentos_gerados_corrige_idx
  on documentos_gerados(corrige_documento_id)
  where corrige_documento_id is not null;
