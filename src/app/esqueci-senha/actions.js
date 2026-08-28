"use server";

import { pedirReset } from "@/lib/auth/resetRequest";

/**
 * Registra o pedido de redefinição. A resposta é SEMPRE a mesma, exista o
 * e-mail ou não: esta tela é pública, e responder "não encontrei" a
 * transformaria num verificador de quais e-mails têm acesso ao painel.
 */
export async function pedirResetAction(_prevState, formData) {
  await pedirReset(formData.get("email"));
  return { ok: true };
}
