"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { atualizarStatus, cancelarNota } from "@/lib/fiscal/notas";

export async function atualizarStatusAction(ref) {
  await requireRole(["admin", "financeiro"]);
  const res = await atualizarStatus(ref);
  if (res.error) return { error: res.error };
  revalidatePath("/admin/fiscal");
  return { ok: true, status: res.nota.status };
}

export async function cancelarNotaAction(ref, justificativa) {
  await requireRole(["admin", "financeiro"]);
  const res = await cancelarNota(ref, justificativa);
  if (res.error) return { error: res.error };
  revalidatePath("/admin/fiscal");
  return { ok: true };
}
