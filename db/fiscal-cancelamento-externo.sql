-- ============================================================================
-- VAMAQ MOTORS — registrar cancelamento feito FORA do sistema.
--
-- POR QUE (24/08/2026): a NF 17 foi cancelada pela contabilidade, no sistema
-- dela. O nosso registro continuou dizendo "autorizada", e a guarda passou a
-- bloquear a reemissão para sempre. Só se resolvia com alguém mexendo no banco
-- — ou seja, a loja dependia de suporte técnico para uma tarefa de operação.
--
-- Agora a operadora registra sozinha, informando o PROTOCOLO do cancelamento.
-- O protocolo é a prova: sem ele, qualquer um marcaria qualquer nota como
-- cancelada e a loja acabaria com duas notas válidas do mesmo carro.
--
-- Guardamos QUEM informou e QUANDO: um cancelamento que o sistema não executou
-- precisa ter origem rastreável.
--
-- Aplicar:  psql "$DATABASE_URL" -f db/fiscal-cancelamento-externo.sql
-- ============================================================================

alter table notas_fiscais
  add column if not exists cancelamento_externo boolean not null default false,
  add column if not exists cancelamento_protocolo text,
  add column if not exists cancelamento_informado_por uuid references users(id) on delete set null;
