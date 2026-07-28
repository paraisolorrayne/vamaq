import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { parseValorBR } from "@/lib/money";
import { getOrcamento, saveOrcamentoMes } from "@/lib/fin/repositories/finance";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireApiRole(["financeiro"]);
  if (auth.error) return auth.error;
  const ano = parseInt(new URL(request.url).searchParams.get("ano") || String(new Date().getFullYear()), 10);
  return NextResponse.json({ ano, meses: await getOrcamento(ano) });
}

export async function POST(request) {
  const auth = await requireApiRole(["financeiro"]);
  if (auth.error) return auth.error;
  const { ano, mes, receita_meta, custo_meta, despesa_meta } = await request.json();
  if (!ano || !mes) return NextResponse.json({ error: "ano/mes obrigatórios" }, { status: 400 });
  await saveOrcamentoMes(ano, mes, {
    receita_meta: parseValorBR(receita_meta) || 0,
    custo_meta: parseValorBR(custo_meta) || 0,
    despesa_meta: parseValorBR(despesa_meta) || 0,
  });
  return NextResponse.json({ ok: true });
}
