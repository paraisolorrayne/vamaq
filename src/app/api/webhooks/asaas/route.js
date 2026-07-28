import { NextResponse } from "next/server";
import { finQuery } from "@/lib/fin/db";
import { getCompanyId } from "@/lib/fin/repositories/finance";
import { lancarRecebimentoSeNecessario } from "@/lib/fin/asaas/cobranca";

// Webhook do Asaas — recebe eventos de cobrança e espelha em fin.asaas_payments.
// Fica FORA de /api/admin (o Asaas chama de fora), mas exige o token combinado
// no header `asaas-access-token` (você define ASAAS_WEBHOOK_TOKEN e cola no
// painel do Asaas). Sem token configurado, o webhook fica desligado (401).
export const dynamic = "force-dynamic";

export async function POST(request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "Webhook desativado" }, { status: 503 });
  }
  const token = request.headers.get("asaas-access-token");
  if (token !== expected) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const p = body?.payment;
  if (!p?.id) {
    // Evento sem cobrança (ex.: teste de conexão do Asaas) — aceita sem gravar.
    return NextResponse.json({ ok: true });
  }

  try {
    const company = await getCompanyId();
    // Espelha (upsert por asaas_id). paid_at só quando recebido/confirmado.
    const paid = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(p.status);
    await finQuery(
      `insert into fin.asaas_payments
         (company_id, asaas_id, asaas_customer, billing_type, status, value,
          net_value, due_date, paid_at, invoice_url, raw)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
       on conflict (asaas_id) do update set
         status = excluded.status,
         net_value = excluded.net_value,
         paid_at = excluded.paid_at,
         invoice_url = excluded.invoice_url,
         raw = excluded.raw`,
      [
        company, p.id, p.customer || null, p.billingType || null, p.status || null,
        p.value ?? null, p.netValue ?? null, p.dueDate || null,
        paid ? (p.paymentDate || p.clientPaymentDate || null) : null,
        p.invoiceUrl || p.bankSlipUrl || null, JSON.stringify(body),
      ]
    );
    // Cobrança paga → lança a receita no financeiro (uma vez, com dedup).
    if (paid) await lancarRecebimentoSeNecessario(p.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Asaas webhook error:", err);
    return NextResponse.json({ error: "Falha ao processar" }, { status: 500 });
  }
}
