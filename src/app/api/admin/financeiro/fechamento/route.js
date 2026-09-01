import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { getFechamentoMes, fecharMes, reabrirMes, listFechamentos } from "@/lib/fin/repositories/finance";

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
  // O mês pedido E a lista do que já foi fechado: a tela mostra os dois, para
  // que "fechei o mês, e agora onde eu vejo?" tenha resposta na própria tela.
  const [atual, fechados] = await Promise.all([getFechamentoMes(ano, mes), listFechamentos()]);
  return NextResponse.json({ ...atual, fechados });
}

export async function POST(request) {
  const auth = await requireApiRole(["financeiro", "secretaria"]);
  if (auth.error) return auth.error;
  const { ano, mes, action } = await request.json();
  if (!ano || !mes) return NextResponse.json({ error: "ano/mes obrigatórios" }, { status: 400 });
  const resultado =
    action === "reabrir" ? await reabrirMes(ano, mes) : await fecharMes(ano, mes, auth.user.id);
  return NextResponse.json({ ...resultado, fechados: await listFechamentos() });
}
