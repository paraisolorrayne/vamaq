/**
 * Pedido de redefinição de senha feito pela própria pessoa, na tela de login.
 *
 * O fluxo inteiro é de propósito o mais simples possível:
 *
 *   pessoa pede → admin vê o pedido em /admin/usuarios → admin clica
 *   "Redefinir" (que já existia) → manda a senha provisória pelo WhatsApp →
 *   a pessoa entra e o sistema já pede a senha nova (admin/layout.js).
 *
 * Por que o admin fica no meio: não há e-mail nem SMS no sistema. Sem canal de
 * entrega, a única forma de "automatizar" seria mostrar a senha provisória na
 * tela para quem digitou o e-mail — o que entregaria o painel (notas fiscais,
 * CPF de clientes) a qualquer pessoa que soubesse o e-mail do Mateus.
 *
 * Server-only (usa pg).
 */
import { query } from "@/lib/db";

// Um pedido a cada 10 minutos por e-mail: a tela é pública, e sem isso um
// robô reescreveria a coluna a cada requisição. Não é rate limit de verdade
// (isso é do servidor web), é para o banco não virar saco de pancada.
const SQL_PEDIR = `
  update users set reset_requested_at = now()
   where email = $1
     and active = true
     and (reset_requested_at is null or reset_requested_at < now() - interval '10 minutes')
`;

const SQL_LIMPAR = `update users set reset_requested_at = null where id = $1`;

const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Registra o pedido. NÃO devolve nada sobre o e-mail — nem se existe, nem se
 * está ativo: a tela mostra sempre a mesma frase, senão a página de "esqueci
 * minha senha" vira um verificador de quais e-mails têm acesso ao painel.
 */
export async function pedirReset(email) {
  const alvo = String(email || "").trim().toLowerCase();
  if (!EMAIL_VALIDO.test(alvo)) return;
  await query(SQL_PEDIR, [alvo]);
}

/** Limpa o pedido pendente (chamado quando o admin redefine a senha). */
export async function limparPedidoReset(id) {
  await query(SQL_LIMPAR, [id]);
}
