import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { listContas, criarConta } from "@/lib/fin/repositories/finance";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiRole(["financeiro", "secretaria"]);
  if (auth.error) return auth.error;
  return NextResponse.json(await listContas());
}

export async function POST(request) {
  const auth = await requireApiRole(["financeiro", "secretaria"]);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const res = await criarConta({ nome: body?.nome, grupoId: body?.grupoId });
  if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(res.conta, { status: 201 });
}
