/**
 * Repositório do financeiro (PR-2 do ADR-002). Lê/escreve `fin.*` pela conexão
 * do financeiro (vamaq_fin) — que só LÊ o estoque. Single-tenant: tudo escopa
 * pela única empresa (Vamaq).
 */
import { finQuery } from "@/lib/fin/db";
import { computeDRE, icmsSeminovo } from "@/lib/fin/calc";

let companyIdCache = null;
export async function getCompanyId() {
  if (companyIdCache) return companyIdCache;
  const { rows } = await finQuery(`select id from fin.companies order by created_at limit 1`);
  companyIdCache = rows[0]?.id || null;
  return companyIdCache;
}

// ---- Dados de referência (para os selects dos formulários) ----------------
export async function getReferencias() {
  const company = await getCompanyId();
  if (!company) return { accounts: [], costCenters: [], banks: [], contacts: [] };
  const [accounts, costCenters, banks, contacts] = await Promise.all([
    finQuery(`select id, code, name, type from fin.chart_of_accounts where company_id=$1 order by code nulls last, name`, [company]),
    finQuery(`select id, name from fin.cost_centers where company_id=$1 order by name`, [company]),
    finQuery(`select id, name, bank_name from fin.bank_accounts where company_id=$1 order by name`, [company]),
    finQuery(`select id, name, doc, kind from fin.contacts where company_id=$1 order by name`, [company]),
  ]);
  return {
    accounts: accounts.rows,
    costCenters: costCenters.rows,
    banks: banks.rows,
    contacts: contacts.rows,
  };
}

const CONTACT_COLS = `id, name, doc, kind, email, phone, created_at`;

export async function listContacts({ search, kind } = {}) {
  const company = await getCompanyId();
  if (!company) return [];
  const where = ["company_id = $1"];
  const params = [company];
  if (kind) { params.push(kind); where.push(`kind = $${params.length}`); }
  if (search) { params.push(`%${search}%`); where.push(`(name ilike $${params.length} or doc ilike $${params.length})`); }
  const { rows } = await finQuery(
    `select ${CONTACT_COLS} from fin.contacts where ${where.join(" and ")} order by name`,
    params
  );
  return rows;
}

export async function getContact(id) {
  const company = await getCompanyId();
  const { rows } = await finQuery(
    `select ${CONTACT_COLS} from fin.contacts where id=$1 and company_id=$2`,
    [id, company]
  );
  return rows[0] || null;
}

export async function createContact({ name, doc, kind, email, phone }) {
  const company = await getCompanyId();
  const { rows } = await finQuery(
    `insert into fin.contacts (company_id, name, doc, kind, email, phone)
       values ($1,$2,$3,$4,$5,$6) returning ${CONTACT_COLS}`,
    [company, name, doc || null, kind || "ambos", email || null, phone || null]
  );
  return rows[0];
}

export async function updateContact(id, { name, doc, kind, email, phone }) {
  const company = await getCompanyId();
  const { rows } = await finQuery(
    `update fin.contacts set name=$3, doc=$4, kind=$5, email=$6, phone=$7
      where id=$1 and company_id=$2 returning ${CONTACT_COLS}`,
    [id, company, name, doc || null, kind || "ambos", email || null, phone || null]
  );
  return rows[0] || null;
}

export async function deleteContact(id) {
  const company = await getCompanyId();
  try {
    const { rowCount } = await finQuery(
      `delete from fin.contacts where id=$1 and company_id=$2`,
      [id, company]
    );
    return { ok: rowCount > 0 };
  } catch (err) {
    // FK: contato usado em lançamento/cobrança não pode ser apagado.
    if (err.code === "23503") return { ok: false, error: "Contato em uso (tem lançamento ou cobrança). Não pode ser removido." };
    throw err;
  }
}

// ---- Lançamentos ----------------------------------------------------------
const TX_SELECT = `
  select t.id, t.date, t.description, t.amount, t.type, t.status, t.source,
         t.account_id, a.code as account_code, a.name as account_name,
         t.cost_center_id, cc.name as cost_center_name,
         t.bank_account_id, b.name as bank_name,
         t.contact_id, ct.name as contact_name,
         t.vehicle_id, v.brand as vehicle_brand, v.model as vehicle_model,
         v.year as vehicle_year, v.placa as vehicle_placa
    from fin.transactions t
    left join fin.chart_of_accounts a on a.id = t.account_id
    left join fin.cost_centers cc on cc.id = t.cost_center_id
    left join fin.bank_accounts b on b.id = t.bank_account_id
    left join fin.contacts ct on ct.id = t.contact_id
    left join public.vehicles v on v.id = t.vehicle_id
`;

function rowToTx(r) {
  return { ...r, amount: r.amount != null ? Number(r.amount) : 0 };
}

export async function listTransactions({ limit = 25, offset = 0, type, status, vehicleId, search } = {}) {
  const company = await getCompanyId();
  if (!company) return { rows: [], total: 0 };
  const where = ["t.company_id = $1"];
  const params = [company];
  if (type) { params.push(type); where.push(`t.type = $${params.length}`); }
  if (status) { params.push(status); where.push(`t.status = $${params.length}`); }
  if (vehicleId) { params.push(vehicleId); where.push(`t.vehicle_id = $${params.length}`); }
  if (search) { params.push(`%${search}%`); where.push(`t.description ilike $${params.length}`); }
  const w = where.join(" and ");

  const totalRes = await finQuery(`select count(*)::int n from fin.transactions t where ${w}`, params);
  params.push(limit); params.push(offset);
  const { rows } = await finQuery(
    `${TX_SELECT} where ${w} order by t.date desc, t.created_at desc limit $${params.length - 1} offset $${params.length}`,
    params
  );
  return { rows: rows.map(rowToTx), total: totalRes.rows[0].n };
}

export async function getTransaction(id) {
  const company = await getCompanyId();
  const { rows } = await finQuery(`${TX_SELECT} where t.id=$1 and t.company_id=$2`, [id, company]);
  return rows.length ? rowToTx(rows[0]) : null;
}

export async function createTransaction(data) {
  const company = await getCompanyId();
  const { rows } = await finQuery(
    `insert into fin.transactions
       (company_id, date, description, amount, type, account_id, cost_center_id,
        bank_account_id, contact_id, vehicle_id, status, source, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'manual',$12)
     returning id`,
    [
      company, data.date, data.description, data.amount, data.type,
      data.account_id || null, data.cost_center_id || null, data.bank_account_id || null,
      data.contact_id || null, data.vehicle_id || null, data.status || "confirmed",
      data.created_by || null,
    ]
  );
  return getTransaction(rows[0].id);
}

export async function updateTransaction(id, data) {
  const company = await getCompanyId();
  // Só lançamentos manuais/whatsapp editam tudo; asaas/bank não deletam nem
  // editam além da classificação (ADR-001c §1). Como só criamos 'manual' por
  // ora, editamos livremente; a guarda por source entra quando houver integração.
  const { rows } = await finQuery(
    `update fin.transactions set
        date=$3, description=$4, amount=$5, type=$6, account_id=$7,
        cost_center_id=$8, bank_account_id=$9, contact_id=$10, vehicle_id=$11, status=$12
      where id=$1 and company_id=$2 returning id`,
    [
      id, company, data.date, data.description, data.amount, data.type,
      data.account_id || null, data.cost_center_id || null, data.bank_account_id || null,
      data.contact_id || null, data.vehicle_id || null, data.status || "confirmed",
    ]
  );
  return rows.length ? getTransaction(id) : null;
}

export async function setTransactionStatus(id, status) {
  const company = await getCompanyId();
  const { rows } = await finQuery(
    `update fin.transactions set status=$3 where id=$1 and company_id=$2 returning id`,
    [id, company, status]
  );
  return rows.length ? getTransaction(id) : null;
}

export async function deleteTransaction(id) {
  const company = await getCompanyId();
  // Só remove os de origem manual (integrações preservam o registro).
  const { rowCount } = await finQuery(
    `delete from fin.transactions where id=$1 and company_id=$2 and source in ('manual','whatsapp')`,
    [id, company]
  );
  return rowCount > 0;
}

// ---- DRE e margens --------------------------------------------------------
export async function getDRE({ from, to } = {}) {
  const company = await getCompanyId();
  if (!company) return computeDRE([]);
  const where = ["t.company_id = $1"];
  const params = [company];
  if (from) { params.push(from); where.push(`t.date >= $${params.length}`); }
  if (to) { params.push(to); where.push(`t.date <= $${params.length}`); }
  const { rows } = await finQuery(
    `select t.type, t.amount, a.code, t.status
       from fin.transactions t
       left join fin.chart_of_accounts a on a.id = t.account_id
      where ${where.join(" and ")}`,
    params
  );
  return computeDRE(rows);
}

export async function getVehicleMargins({ onlyWithActivity = true } = {}) {
  const company = await getCompanyId();
  if (!company) return [];
  // Alíquota de ICMS do seminovo (base = lucro venda − compra). Contador: 5%.
  const cfg = await finQuery(`select icms_seminovo_aliquota from fin.companies where id=$1`, [company]);
  const aliquota = Number(cfg.rows[0]?.icms_seminovo_aliquota ?? 5);

  // custo de aquisição = despesas na conta 4.1x (Custo de Aquisição de Veículos);
  // custo_total = todas as despesas do veículo (aquisição + preparação + etc.).
  const { rows } = await finQuery(
    `select v.id as vehicle_id, v.brand, v.model, v.year, v.placa, v.status,
            coalesce(sum(t.amount) filter (where t.type='revenue'), 0) as receita,
            coalesce(sum(t.amount) filter (where t.type='expense'), 0) as custo_total,
            coalesce(sum(t.amount) filter (where t.type='expense' and a.code like '4.1%'), 0) as custo_aquisicao
       from public.vehicles v
       left join fin.transactions t on t.vehicle_id = v.id and t.status in ('confirmed','reconciled')
       left join fin.chart_of_accounts a on a.id = t.account_id
      group by v.id, v.brand, v.model, v.year, v.placa, v.status
      ${onlyWithActivity ? "having coalesce(sum(t.amount),0) <> 0" : ""}
      order by (coalesce(sum(t.amount) filter (where t.type='revenue'),0) - coalesce(sum(t.amount) filter (where t.type='expense'),0)) desc`
  );

  return rows.map((r) => {
    const receita = Number(r.receita);
    const custo_total = Number(r.custo_total);
    const custo_aquisicao = Number(r.custo_aquisicao);
    const resultado = round2(receita - custo_total);
    const icms = icmsSeminovo(receita, custo_aquisicao, aliquota);
    return {
      vehicle_id: r.vehicle_id, brand: r.brand, model: r.model, year: r.year,
      placa: r.placa, status: r.status,
      receita, custo_total, custo_aquisicao,
      resultado,
      icms,
      resultado_liquido: round2(resultado - icms),
    };
  });
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

// ---- Contas a pagar --------------------------------------------------------
const BILL_SELECT = `
  select b.id, b.description, b.value, b.due_date, b.approval_status,
         b.paid_at, b.created_by, b.approved_by, b.approved_at,
         b.contact_id, ct.name as contact_name,
         b.account_id, a.code as account_code, a.name as account_name,
         b.cost_center_id, cc.name as cost_center_name
    from fin.bills_payable b
    left join fin.contacts ct on ct.id = b.contact_id
    left join fin.chart_of_accounts a on a.id = b.account_id
    left join fin.cost_centers cc on cc.id = b.cost_center_id
`;

function rowToBill(r) {
  return { ...r, value: r.value != null ? Number(r.value) : 0 };
}

export async function listBills() {
  const company = await getCompanyId();
  if (!company) return [];
  const { rows } = await finQuery(
    `${BILL_SELECT} where b.company_id=$1 order by (b.paid_at is not null), b.due_date`,
    [company]
  );
  return rows.map(rowToBill);
}

export async function getBill(id) {
  const company = await getCompanyId();
  const { rows } = await finQuery(`${BILL_SELECT} where b.id=$1 and b.company_id=$2`, [id, company]);
  return rows.length ? rowToBill(rows[0]) : null;
}

// approvalStatus decidido pelo servidor (alçada) — nunca vem do cliente.
export async function createBill(data, approvalStatus, createdBy) {
  const company = await getCompanyId();
  const { rows } = await finQuery(
    `insert into fin.bills_payable
       (company_id, description, value, due_date, contact_id, account_id, cost_center_id, approval_status, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [company, data.description, data.value, data.due_date, data.contact_id || null,
     data.account_id || null, data.cost_center_id || null, approvalStatus, createdBy || null]
  );
  return getBill(rows[0].id);
}

export async function setBillApproval(id, status, approverId) {
  const company = await getCompanyId();
  const { rows } = await finQuery(
    `update fin.bills_payable
        set approval_status=$3,
            approved_by = case when $3='approved' then $4 else approved_by end,
            approved_at = case when $3='approved' then now() else approved_at end
      where id=$1 and company_id=$2 returning id`,
    [id, company, status, approverId || null]
  );
  return rows.length ? getBill(id) : null;
}

export async function markBillPaid(id, paid) {
  const company = await getCompanyId();
  // só paga conta aprovada
  const { rows } = await finQuery(
    `update fin.bills_payable
        set paid_at = case when $3 then coalesce(paid_at, current_date) else null end
      where id=$1 and company_id=$2 and approval_status='approved' returning id`,
    [id, company, Boolean(paid)]
  );
  return rows.length ? getBill(id) : null;
}

export async function deleteBill(id) {
  const company = await getCompanyId();
  const { rowCount } = await finQuery(
    `delete from fin.bills_payable where id=$1 and company_id=$2 and paid_at is null`,
    [id, company]
  );
  return rowCount > 0;
}
