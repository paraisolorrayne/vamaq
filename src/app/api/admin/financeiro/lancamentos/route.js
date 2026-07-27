import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { parseValorBR } from "@/lib/money";
import { listTransactions, createTransaction } from "@/lib/fin/repositories/finance";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireApiRole(["financeiro"]);
  if (auth.error) return auth.error;
  const sp = new URL(request.url).searchParams;
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const limit = 25;
  const res = await listTransactions({
    limit,
    offset: (page - 1) * limit,
    type: sp.get("type") || undefined,
    status: sp.get("status") || undefined,
    vehicleId: sp.get("vehicle_id") || undefined,
    search: sp.get("search") || undefined,
  });
  return NextResponse.json({ ...res, page, limit });
}

export async function POST(request) {
  const auth = await requireApiRole(["financeiro"]);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    const amount = parseValorBR(body.amount);
    if (!body.date || !body.description || !isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Data, descrição e valor são obrigatórios" }, { status: 400 });
    }
    if (!["revenue", "expense"].includes(body.type)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }
    const tx = await createTransaction({ ...body, amount, created_by: auth.user.id });
    return NextResponse.json(tx, { status: 201 });
  } catch (err) {
    console.error("Lançamento create error:", err);
    return NextResponse.json({ error: `Erro ao salvar lançamento: ${err.message}` }, { status: 500 });
  }
}
