import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { alternarConta } from "@/lib/fin/repositories/finance";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  const auth = await requireApiRole(["financeiro", "secretaria"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  // Exige o booleano explícito: um PATCH vazio não pode desligar categoria
  // por omissão — foi assim que um cliente já foi desativado sem querer.
  if (typeof body?.ativo !== "boolean") {
    return NextResponse.json({ error: "Informe se a categoria fica ativa." }, { status: 400 });
  }
  const res = await alternarConta(id, body.ativo);
  if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(res.conta);
}
