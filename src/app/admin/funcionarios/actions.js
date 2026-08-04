"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import {
  createFuncionario,
  updateFuncionario,
  admitir,
  desligar,
} from "@/lib/rh/funcionarios";

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
