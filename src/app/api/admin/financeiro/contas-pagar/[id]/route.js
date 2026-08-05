import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { podeAprovar } from "@/lib/fin/calc";
import { getBill, setBillApproval, markBillPaid, deleteBill } from "@/lib/fin/repositories/finance";

// Ações: approve | reject | pay | unpay. Aprovar exige alçada suficiente
// (correção #1). Aprovar NÃO paga; pagar só conta aprovada.
export async function PATCH(request, { params }) {
  const auth = await requireApiRole(["financeiro", "secretaria"]);
  if (auth.error) return auth.error;
  const { id } = await params;
  const { action } = await request.json();

  const bill = await getBill(id);
  if (!bill) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "approve") {
    if (!podeAprovar(auth.user, bill.value)) {
      return NextResponse.json({ error: "Valor acima da sua alçada de aprovação." }, { status: 403 });
    }
    return NextResponse.json(await setBillApproval(id, "approved", auth.user.id));
  }
  if (action === "reject") {
    return NextResponse.json(await setBillApproval(id, "rejected", auth.user.id));
  }
  if (action === "pay") {
    const r = await markBillPaid(id, true);
    if (!r) return NextResponse.json({ error: "Só é possível pagar conta aprovada." }, { status: 400 });
    return NextResponse.json(r);
  }
  if (action === "unpay") {
    return NextResponse.json(await markBillPaid(id, false));
  }
  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}

export async function DELETE(_request, { params }) {
  const auth = await requireApiRole(["financeiro", "secretaria"]);
  if (auth.error) return auth.error;
  const { id } = await params;
  const ok = await deleteBill(id);
  if (!ok) return NextResponse.json({ error: "Não encontrada ou já paga" }, { status: 400 });
  return NextResponse.json({ success: true });
}
