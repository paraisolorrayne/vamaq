"use server";

import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";

/**
 * Server Action de login. Recebe o FormData do form.
 * Retorna { error } em caso de falha (mensagem genérica — não revela se o
 * e-mail existe); em sucesso, cria a sessão e redireciona.
 */
export async function loginAction(_prevState, formData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/admin");

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const { rows } = await query(
    `select id, password_hash, active from users where email = $1 limit 1`,
    [email]
  );
  const user = rows[0];

  // Mensagem única para credencial inválida OU usuário inativo — não vaza
  // quais e-mails existem.
  const ok =
    user && user.active && (await verifyPassword(password, user.password_hash));
  if (!ok) {
    return { error: "E-mail ou senha inválidos." };
  }

  await createSession(user.id);
  // redireciona só para caminhos internos do admin (evita open redirect).
  const dest = next.startsWith("/admin") ? next : "/admin";
  redirect(dest);
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
