"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { atualizarStatus, cancelarNota, emitirNotaVeiculo } from "@/lib/fiscal/notas";

export async function atualizarStatusAction(ref) {
  await requireRole(["financeiro", "secretaria"]);
  const res = await atualizarStatus(ref);
  if (res.error) return { error: res.error };
  revalidatePath("/admin/fiscal");
  return { ok: true, status: res.nota.status };
}

export async function cancelarNotaAction(ref, justificativa) {
  await requireRole(["financeiro", "secretaria"]);
  const res = await cancelarNota(ref, justificativa);
  if (res.error) return { error: res.error };
  revalidatePath("/admin/fiscal");
  return { ok: true };
}

export async function emitirNotaAction(vehicleId, { destinatario, valorVenda, custoAquisicao, clienteId }) {
  await requireRole(["financeiro", "secretaria"]);
  const res = await emitirNotaVeiculo(vehicleId, { destinatario, valorVenda, custoAquisicao, clienteId });
  if (res.error) return { error: res.error };
  revalidatePath("/admin/fiscal");
  return { ok: true, ref: res.nota.ref, status: res.nota.status };
}
