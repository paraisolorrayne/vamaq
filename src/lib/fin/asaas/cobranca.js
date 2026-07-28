/**
 * Emissão e listagem de cobranças (Asaas). Orquestra o cliente Asaas + o
 * espelho local fin.asaas_payments. Só emite se o Asaas estiver configurado.
 */
import { finQuery } from "@/lib/fin/db";
import { getCompanyId } from "@/lib/fin/repositories/finance";
import { asaasEnabled, createCustomer, createPayment } from "@/lib/fin/asaas/client";

export { asaasEnabled };

/**
 * Emite uma cobrança no Asaas e espelha localmente.
 * @param {{contact_id?:string, name:string, cpfCnpj?:string, email?:string,
 *   phone?:string, billingType:string, value:number, dueDate:string,
 *   description?:string, vehicle_id?:string}} data
 */
export async function emitirCobranca(data) {
  if (!asaasEnabled()) {
    return { error: "Integração Asaas não configurada." };
  }
  const company = await getCompanyId();

  // Se veio contact_id, usa os dados do contato salvo.
  let { name, cpfCnpj, email, phone } = data;
  if (data.contact_id) {
    const { rows } = await finQuery(
      `select name, doc, email, phone from fin.contacts where id=$1 and company_id=$2`,
      [data.contact_id, company]
    );
    if (rows[0]) {
      name = name || rows[0].name;
      cpfCnpj = cpfCnpj || rows[0].doc;
      email = email || rows[0].email;
      phone = phone || rows[0].phone;
    }
  }
  if (!name) return { error: "Informe o cliente (nome)." };

  const customer = await createCustomer({ name, cpfCnpj, email, phone });
  const payment = await createPayment({
    customer: customer.id,
    billingType: data.billingType,
    value: data.value,
    dueDate: data.dueDate,
    description: data.description,
    externalReference: data.vehicle_id || undefined,
  });

  await finQuery(
    `insert into fin.asaas_payments
       (company_id, asaas_id, asaas_customer, contact_id, vehicle_id, billing_type,
        status, value, due_date, invoice_url, raw)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
     on conflict (asaas_id) do nothing`,
    [
      company, payment.id, customer.id, data.contact_id || null, data.vehicle_id || null,
      payment.billingType || data.billingType, payment.status || "PENDING",
      payment.value ?? data.value, payment.dueDate || data.dueDate,
      payment.invoiceUrl || payment.bankSlipUrl || null, JSON.stringify(payment),
    ]
  );

  return {
    ok: true,
    id: payment.id,
    invoiceUrl: payment.invoiceUrl || payment.bankSlipUrl || null,
    status: payment.status,
  };
}

const STATUS_LABEL = {
  PENDING: "A vencer",
  RECEIVED: "Recebida",
  CONFIRMED: "Recebida",
  RECEIVED_IN_CASH: "Recebida (dinheiro)",
  OVERDUE: "Vencida",
  REFUNDED: "Estornada",
  DELETED: "Cancelada",
};

/**
 * Ao receber pagamento (webhook), lança a receita no financeiro — uma vez só.
 * Dedup por (source='asaas', external_id) e vínculo transaction_id, então
 * eventos repetidos não duplicam. Só roda para cobrança paga ainda sem lançamento.
 */
export async function lancarRecebimentoSeNecessario(asaasId) {
  const company = await getCompanyId();
  const { rows } = await finQuery(
    `select * from fin.asaas_payments where asaas_id=$1 and company_id=$2`,
    [asaasId, company]
  );
  const p = rows[0];
  if (!p) return;
  const paid = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(p.status);
  if (!paid || p.transaction_id) return;

  const ins = await finQuery(
    `insert into fin.transactions
       (company_id, date, description, amount, type, contact_id, vehicle_id, status, source, external_id)
     values ($1, coalesce($2, current_date), $3, $4, 'revenue', $5, $6, 'reconciled', 'asaas', $7)
     on conflict (company_id, source, external_id) where external_id is not null do nothing
     returning id`,
    [company, p.paid_at, `Recebimento Asaas ${p.asaas_id}`, p.value, p.contact_id, p.vehicle_id, p.asaas_id]
  );
  let txId = ins.rows[0]?.id;
  if (!txId) {
    const ex = await finQuery(
      `select id from fin.transactions where company_id=$1 and source='asaas' and external_id=$2`,
      [company, p.asaas_id]
    );
    txId = ex.rows[0]?.id;
  }
  if (txId) {
    await finQuery(`update fin.asaas_payments set transaction_id=$2 where id=$1`, [p.id, txId]);
  }
}

export async function listCobrancas() {
  const company = await getCompanyId();
  if (!company) return [];
  const { rows } = await finQuery(
    `select p.id, p.asaas_id, p.billing_type, p.status, p.value, p.due_date,
            p.paid_at, p.invoice_url, ct.name as contact_name,
            v.brand as vehicle_brand, v.model as vehicle_model
       from fin.asaas_payments p
       left join fin.contacts ct on ct.id = p.contact_id
       left join public.vehicles v on v.id = p.vehicle_id
      where p.company_id = $1
      order by p.due_date desc nulls last, p.created_at desc`,
    [company]
  );
  return rows.map((r) => ({
    ...r,
    value: r.value != null ? Number(r.value) : 0,
    status_label: STATUS_LABEL[r.status] || r.status || "—",
  }));
}
