import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { parseValorBR } from "@/lib/money";
import { emitirCobranca, listCobrancas, asaasEnabled } from "@/lib/fin/asaas/cobranca";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiRole(["financeiro", "secretaria"]);
  if (auth.error) return auth.error;
  return NextResponse.json({ enabled: asaasEnabled(), cobrancas: await listCobrancas() });
}

export async function POST(request) {
  const auth = await requireApiRole(["financeiro", "secretaria"]);
  if (auth.error) return auth.error;
  if (!asaasEnabled()) {
    return NextResponse.json(
      { error: "Integração Asaas não configurada. Ative em docs/INTEGRACAO-ASAAS.md." },
      { status: 400 }
    );
  }
  try {
    const body = await request.json();
    const value = parseValorBR(body.value);
    if (!isFinite(value) || value <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }
    if (!body.dueDate) return NextResponse.json({ error: "Informe o vencimento" }, { status: 400 });
    if (!["BOLETO", "PIX"].includes(body.billingType)) {
      return NextResponse.json({ error: "Tipo de cobrança inválido" }, { status: 400 });
    }
    const res = await emitirCobranca({ ...body, value });
    if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json(res, { status: 201 });
  } catch (err) {
    console.error("Cobrança Asaas error:", err);
    return NextResponse.json({ error: `Falha ao emitir cobrança: ${err.message}` }, { status: 502 });
  }
}
