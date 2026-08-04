"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import {
  createUser,
  resetPassword,
  setUserActive,
  updateUserRole,
  updateApprovalLimit,
  setUserFuncionario,
} from "@/lib/auth/users";

const LOGIN_URL = "https://vamaqmotors.com.br/login";

// Texto pronto para o admin copiar e enviar (WhatsApp, e-mail...) à pessoa.
function buildAccessText({ name, email, tempPassword }) {
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

export async function createUserAction(_prev, formData) {
  await requireRole("admin");
  const name = String(formData.get("name") || "").trim();
  const login = String(formData.get("login") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "");
  // login pode vir só como "victor" → completa o domínio da loja.
  const email = login.includes("@") ? login : `${login}@vamaqmotors.com.br`;

  const res = await createUser({ name, email, role });
  if (res.error) return { error: res.error };

  revalidatePath("/admin/usuarios");
  return {
    ok: true,
    kind: "criada",
    email: res.user.email,
    accessText: buildAccessText({ name, email: res.user.email, tempPassword: res.tempPassword }),
  };
}

export async function resetPasswordAction(id) {
  await requireRole("admin");
  const res = await resetPassword(id);
  if (res.error) return { error: res.error };

  revalidatePath("/admin/usuarios");
  return {
    ok: true,
    kind: "redefinida",
    email: res.user.email,
    accessText: buildAccessText({
      name: res.user.name,
      email: res.user.email,
      tempPassword: res.tempPassword,
    }),
  };
}

export async function toggleActiveAction(id, active) {
  await requireRole("admin");
  await setUserActive(id, active);
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

export async function updateRoleAction(id, role) {
  await requireRole("admin");
  const res = await updateUserRole(id, role);
  if (res.error) return { error: res.error };
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

export async function updateLimitAction(id, limit) {
  await requireRole("admin");
  await updateApprovalLimit(id, limit);
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

export async function vincularFuncionarioAction(userId, funcionarioId) {
  await requireRole("admin");
  try {
    await setUserFuncionario(userId, funcionarioId || null);
  } catch (err) {
    if (err?.constraint === "users_funcionario_idx") {
      return { error: "Essa ficha já está ligada a outro login." };
    }
    throw err;
  }
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/funcionarios");
  return { ok: true };
}
