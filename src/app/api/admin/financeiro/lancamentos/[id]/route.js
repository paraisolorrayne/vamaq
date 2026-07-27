import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { parseValorBR } from "@/lib/money";
import {
  getTransaction,
  updateTransaction,
  setTransactionStatus,
  deleteTransaction,
} from "@/lib/fin/repositories/finance";

export async function GET(_request, { params }) {
  const auth = await requireApiRole(["financeiro"]);
  if (auth.error) return auth.error;
  const { id } = await params;
  const tx = await getTransaction(id);
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(tx);
}

export async function PUT(request, { params }) {
  const auth = await requireApiRole(["financeiro"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const body = await request.json();
    const amount = parseValorBR(body.amount);
    if (!body.date || !body.description || !isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Data, descrição e valor são obrigatórios" }, { status: 400 });
    }
    const tx = await updateTransaction(id, { ...body, amount });
    if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(tx);
  } catch (err) {
    console.error("Lançamento update error:", err);
    return NextResponse.json({ error: `Erro ao salvar: ${err.message}` }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireApiRole(["financeiro"]);
  if (auth.error) return auth.error;
  const { id } = await params;
  const { status } = await request.json();
  if (!["pending", "confirmed", "reconciled"].includes(status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }
  const tx = await setTransactionStatus(id, status);
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(tx);
}

export async function DELETE(_request, { params }) {
  const auth = await requireApiRole(["financeiro"]);
  if (auth.error) return auth.error;
  const { id } = await params;
  const ok = await deleteTransaction(id);
  if (!ok) return NextResponse.json({ error: "Não encontrado ou não removível" }, { status: 404 });
  return NextResponse.json({ success: true });
}
