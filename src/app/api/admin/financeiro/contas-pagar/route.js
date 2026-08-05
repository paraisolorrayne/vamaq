import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { parseValorBR } from "@/lib/money";
import { podeAprovar } from "@/lib/fin/calc";
import { listBills, createBill } from "@/lib/fin/repositories/finance";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiRole(["financeiro", "secretaria"]);
  if (auth.error) return auth.error;
  return NextResponse.json({ bills: await listBills() });
}

export async function POST(request) {
  const auth = await requireApiRole(["financeiro", "secretaria"]);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    const value = parseValorBR(body.value);
    if (!body.description || !body.due_date || !isFinite(value) || value <= 0) {
      return NextResponse.json({ error: "Descrição, vencimento e valor são obrigatórios" }, { status: 400 });
    }
    // Alçada no servidor: dentro do limite → já aprovado; acima → aguarda aprovação.
    const approvalStatus = podeAprovar(auth.user, value) ? "approved" : "awaiting_approval";
    const bill = await createBill({ ...body, value }, approvalStatus, auth.user.id);
    return NextResponse.json(bill, { status: 201 });
  } catch (err) {
    console.error("Conta a pagar create error:", err);
    return NextResponse.json({ error: `Erro ao salvar: ${err.message}` }, { status: 500 });
  }
}
