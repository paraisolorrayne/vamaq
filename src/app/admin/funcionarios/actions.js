"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import {
  createFuncionario,
  updateFuncionario,
  admitir,
  desligar,
} from "@/lib/rh/funcionarios";
import { createUser } from "@/lib/auth/users";

const LOGIN_URL = "https://vamaqmotors.com.br/login";

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

/** Campos da ficha lidos do formulário. */
function fichaFrom(formData) {
  return {
    nome: formData.get("nome"),
    cpf: formData.get("cpf"),
    rg: formData.get("rg"),
    nascimento: formData.get("nascimento") || null,
    telefone: formData.get("telefone"),
    email_pessoal: formData.get("email_pessoal"),
    endereco: formData.get("endereco"),
    obs: formData.get("obs"),
  };
}

export async function createFuncionarioAction(formData) {
  await requireRole("admin");
  const res = await createFuncionario(fichaFrom(formData));
  if (res.error) return { error: res.error };
  revalidatePath("/admin/funcionarios");
  return { ok: true, id: res.funcionario.id };
}

export async function updateFuncionarioAction(id, formData) {
  await requireRole("admin");
  const res = await updateFuncionario(id, fichaFrom(formData));
  if (res.error) return { error: res.error };
  revalidatePath("/admin/funcionarios");
  revalidatePath(`/admin/funcionarios/${id}`);
  return { ok: true };
}

export async function admitirAction(id, { cargo, admissao, obs }) {
  await requireRole("admin");
  const res = await admitir(id, { cargo, admissao, obs });
  if (res.error) return { error: res.error };
  revalidatePath("/admin/funcionarios");
  revalidatePath(`/admin/funcionarios/${id}`);
  return { ok: true };
}

export async function desligarAction(id, { saida, motivo }) {
  await requireRole("admin");
  const res = await desligar(id, { saida, motivo });
  if (res.error) return { error: res.error };
  revalidatePath("/admin/funcionarios");
  revalidatePath(`/admin/funcionarios/${id}`);
  revalidatePath("/admin/usuarios");
  // acessoCortado avisa a tela de que o login foi desativado junto.
  return { ok: true, acessoCortado: Boolean(res.user_id) };
}

/** Cria o login já vinculado à ficha. Devolve a senha em claro UMA vez. */
export async function criarAcessoAction(funcionarioId, { nome, login, role }) {
  await requireRole("admin");
  const l = String(login || "").trim().toLowerCase();
  const email = l.includes("@") ? l : `${l}@vamaqmotors.com.br`;

  const res = await createUser({ name: nome, email, role, funcionario_id: funcionarioId });
  if (res.error) return { error: res.error };

  revalidatePath(`/admin/funcionarios/${funcionarioId}`);
  revalidatePath("/admin/usuarios");
  return {
    ok: true,
    email: res.user.email,
    accessText: buildAccessText({ name: nome, email: res.user.email, tempPassword: res.tempPassword }),
  };
}
