import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { getFechamentoMes, fecharMes, reabrirMes } from "@/lib/fin/repositories/finance";

export const dynamic = "force-dynamic";

function parseYm(sp) {
  const now = new Date();
  const ano = parseInt(sp.get("ano") || String(now.getFullYear()), 10);
  const mes = parseInt(sp.get("mes") || String(now.getMonth() + 1), 10);
  return { ano, mes };
}

export async function GET(request) {
  const auth = await requireApiRole(["financeiro", "secretaria"]);
  if (auth.error) return auth.error;
  const { ano, mes } = parseYm(new URL(request.url).searchParams);
  return NextResponse.json(await getFechamentoMes(ano, mes));
}

export async function POST(request) {
  const auth = await requireApiRole(["financeiro", "secretaria"]);
  if (auth.error) return auth.error;
  const { ano, mes, action } = await request.json();
  if (!ano || !mes) return NextResponse.json({ error: "ano/mes obrigatórios" }, { status: 400 });
  if (action === "reabrir") return NextResponse.json(await reabrirMes(ano, mes));
  return NextResponse.json(await fecharMes(ano, mes, auth.user.id));
}
