/**
 * Texto de instruções de acesso (link + usuário + senha temporária), pronto
 * para o admin copiar e enviar (WhatsApp, e-mail...) à pessoa.
 *
 * Compartilhado entre `/admin/usuarios` e `/admin/funcionarios` — as duas
 * telas criam login e precisam do MESMO texto/link. Fica aqui para não haver
 * duas cópias divergindo em silêncio.
 */

export const LOGIN_URL = "https://vamaqmotors.com.br/login";

export function buildAccessText({ name, email, tempPassword }) {
  return [
    `Olá, ${name}! Seu acesso ao Painel Vamaq Motors:`,
    ``,
    `Link: ${LOGIN_URL}`,
    `Usuário: ${email}`,
    `Senha temporária: ${tempPassword}`,
    ``,
    `No primeiro acesso o sistema vai pedir para você criar uma senha nova.`,
  ].join("\n");
}
