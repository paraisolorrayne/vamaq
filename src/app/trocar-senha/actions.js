"use server";

import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { requireUser } from "@/lib/auth/dal";

/**
 * Troca a senha do usuário logado. Exige a senha atual (a inicial no primeiro
 * acesso), nova senha e confirmação. Ao concluir, limpa must_change_password.
 */
export async function changePasswordAction(_prevState, formData) {
  const user = await requireUser();

  const current = String(formData.get("current") || "");
  const next = String(formData.get("next") || "");
  const confirm = String(formData.get("confirm") || "");

  if (!current || !next || !confirm) {
    return { error: "Preencha todos os campos." };
  }
  if (next.length < 8) {
    return { error: "A nova senha deve ter ao menos 8 caracteres." };
  }
  if (next !== confirm) {
    return { error: "A confirmação não bate com a nova senha." };
  }

  const { rows } = await query(
    `select password_hash from users where id = $1 limit 1`,
    [user.id]
  );
  const ok = rows[0] && (await verifyPassword(current, rows[0].password_hash));
  if (!ok) {
    return { error: "Senha atual incorreta." };
  }
  if (next === current) {
    return { error: "A nova senha deve ser diferente da atual." };
  }

  const password_hash = await hashPassword(next);
  await query(
    `update users set password_hash = $1, must_change_password = false where id = $2`,
    [password_hash, user.id]
  );

  redirect("/admin");
}
