-- ============================================================================
-- VAMAQ MOTORS — pedido de redefinição de senha feito pela própria pessoa.
--
-- O admin já sabia redefinir senha (gera provisória + must_change_password).
-- O que faltava era a pessoa conseguir PEDIR sem caçar alguém: ela pede na
-- tela de login, o pedido aparece em /admin/usuarios e quem redefine continua
-- sendo o admin — porque não existe e-mail nem SMS no sistema para entregar a
-- senha provisória, e mostrá-la na tela para quem digitou um e-mail entregaria
-- o painel inteiro a qualquer um.
--
-- Uma coluna basta: o pedido é um estado (pendente ou não), não um histórico.
-- Redefinir a senha limpa o pedido (ver resetPassword em lib/auth/users.js).
--
-- Aplicar:  psql "$DATABASE_URL" -f db/auth-reset-senha.sql   (seguro re-aplicar)
-- ============================================================================

alter table users add column if not exists reset_requested_at timestamptz;

comment on column users.reset_requested_at is
  'Quando a pessoa pediu redefinição de senha na tela de login. null = sem pedido pendente.';
