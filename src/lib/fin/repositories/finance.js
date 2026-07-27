/**
 * Repositório do financeiro (PR-2 do ADR-002). Lê/escreve `fin.*` pela conexão
 * do financeiro (vamaq_fin) — que só LÊ o estoque. Single-tenant: tudo escopa
 * pela única empresa (Vamaq).
 */
import { finQuery } from "@/lib/fin/db";
import { computeDRE } from "@/lib/fin/calc";

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

export async function createContact({ name, doc, kind, email, phone }) {
  const company = await getCompanyId();
  const { rows } = await finQuery(
    `insert into fin.contacts (company_id, name, doc, kind, email, phone)
       values ($1,$2,$3,$4,$5,$6) returning id, name, doc, kind`,
    [company, name, doc || null, kind || "ambos", email || null, phone || null]
  );
  return rows[0];
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
  // A view já calcula receita/custo/resultado por veículo.
  const { rows } = await finQuery(
    `select vehicle_id, brand, model, year, placa, status, receita, custo_total, resultado
       from fin.v_vehicle_margin
      ${onlyWithActivity ? "where receita <> 0 or custo_total <> 0" : ""}
      order by resultado desc`
  );
  return rows.map((r) => ({
    ...r,
    receita: Number(r.receita),
    custo_total: Number(r.custo_total),
    resultado: Number(r.resultado),
  }));
}
