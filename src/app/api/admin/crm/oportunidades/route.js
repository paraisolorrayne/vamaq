import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { listOportunidades, createOportunidade } from "@/lib/crm/oportunidades";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiRole(["vendedor"]);
  if (auth.error) return auth.error;
  return NextResponse.json({ oportunidades: await listOportunidades() });
}

export async function POST(request) {
  const auth = await requireApiRole(["vendedor"]);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    if (!body.cliente_nome || !body.cliente_nome.trim()) {
      return NextResponse.json({ error: "Nome do cliente é obrigatório" }, { status: 400 });
    }
    const o = await createOportunidade(body, auth.user.id);
    return NextResponse.json(o, { status: 201 });
  } catch (err) {
    console.error("Oportunidade create error:", err);
    return NextResponse.json({ error: `Erro ao salvar: ${err.message}` }, { status: 500 });
  }
}
