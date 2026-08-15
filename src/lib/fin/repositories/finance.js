/**
 * Repositório do financeiro (PR-2 do ADR-002). Lê/escreve `fin.*` pela conexão
 * do financeiro (vamaq_fin) — que só LÊ o estoque. Single-tenant: tudo escopa
 * pela única empresa (Vamaq).
 */
import { finQuery } from "@/lib/fin/db";
// Conexão principal: a role do financeiro só tem SELECT em public.vehicles
// (ver db/fin-blindagem.sql), e o checklist precisa ler notas_fiscais também.
import { query } from "@/lib/db";
import { computeDRE } from "@/lib/fin/calc";
import { impostosVeiculoUsado } from "@/lib/fiscal/impostos";
import { GRUPOS, ordenaContas, proximoCodigo, validaNomeConta } from "@/lib/fin/planoContas";
import { scoreSaudeFinanceira } from "@/lib/fin/saude";

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
    finQuery(
      `select id, code, name, type, editable, ativo from fin.chart_of_accounts
        where company_id=$1 and ativo`,
      [company]
    ),
    finQuery(`select id, name from fin.cost_centers where company_id=$1 order by name`, [company]),
    finQuery(`select id, name, bank_name from fin.bank_accounts where company_id=$1 order by name`, [company]),
    finQuery(`select id, name, doc, kind from fin.contacts where company_id=$1 order by name`, [company]),
  ]);
  return {
    // Ordem natural (5.1.2 antes de 5.1.10) — ordenar código como texto
    // embaralha a lista assim que um grupo passa de nove contas.
    accounts: ordenaContas(accounts.rows),
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
  // Impostos da venda de seminovo, pela MESMA função que monta a nota — ver
  // src/lib/fiscal/impostos.js, que reproduz a NF 12 autorizada ao centavo.
  // Antes daqui saía só um ICMS calculado por conta própria; agora a coluna
  // do relatório e o imposto da nota são o mesmo número, por construção.
  //
  // A alíquota vem do cadastro do financeiro; os demais parâmetros ficam no
  // padrão. Para EMITIR a nota quem manda é `fiscal_config` — aqui é
  // estimativa de margem, não documento fiscal.
  const cfg = await finQuery(`select icms_seminovo_aliquota from fin.companies where id=$1`, [company]);
  const paramsImposto = { icms_seminovo_aliquota: cfg.rows[0]?.icms_seminovo_aliquota };

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
    const imp = impostosVeiculoUsado(receita, custo_aquisicao, paramsImposto);
    const impostos = round2(imp.icms + imp.pis + imp.cofins);
    return {
      vehicle_id: r.vehicle_id, brand: r.brand, model: r.model, year: r.year,
      placa: r.placa, status: r.status,
      receita, custo_total, custo_aquisicao,
      resultado,
      icms: imp.icms,
      pis: imp.pis,
      cofins: imp.cofins,
      impostos,
      resultado_liquido: round2(resultado - impostos),
    };
  });
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

// ---- Plano de contas (categorias) ------------------------------------------

/** Todas as contas, inclusive as desativadas — para a tela de categorias. */
export async function listContas() {
  const company = await getCompanyId();
  if (!company) return [];
  const { rows } = await finQuery(
    `select id, code, name, type, editable, ativo from fin.chart_of_accounts where company_id=$1`,
    [company]
  );
  return ordenaContas(rows);
}

/**
 * Cria uma categoria. O código sai do grupo escolhido — a operadora nunca
 * digita "5.1.7", porque errar o código põe a despesa no lugar errado do DRE.
 */
export async function criarConta({ nome, grupoId }) {
  const company = await getCompanyId();
  if (!company) return { error: "Financeiro não configurado." };

  const grupo = GRUPOS.find((g) => g.id === grupoId);
  if (!grupo) return { error: "Escolha onde a categoria entra." };

  // Valida contra TODAS as contas, inclusive desativadas: recriar uma categoria
  // com o nome de outra que foi desligada deixaria duas iguais no histórico.
  const existentes = await listContas();
  const nomeOk = validaNomeConta(nome, grupo, existentes);
  if (nomeOk.error) return { error: nomeOk.error };

  const code = proximoCodigo(grupo.prefixo, existentes);
  const { rows } = await finQuery(
    `insert into fin.chart_of_accounts (company_id, code, name, type, editable)
     values ($1,$2,$3,$4,true)
     returning id, code, name, type, editable, ativo`,
    [company, code, nomeOk.nome, grupo.tipo]
  );
  return { conta: rows[0] };
}

/**
 * Liga/desliga uma categoria. Nunca apaga: os lançamentos antigos apontam para
 * ela, e o DRE de meses fechados precisa continuar batendo.
 *
 * As contas do plano original (`editable = false`) não se desativam — o DRE e a
 * margem por veículo dependem delas existirem.
 */
export async function alternarConta(id, ativo) {
  const company = await getCompanyId();
  if (!company) return { error: "Financeiro não configurado." };
  if (typeof ativo !== "boolean") return { error: "Informe se a categoria fica ativa." };

  const { rows } = await finQuery(
    `update fin.chart_of_accounts set ativo=$3
      where id=$1 and company_id=$2 and editable
      returning id, code, name, type, editable, ativo`,
    [id, company, ativo]
  );
  if (!rows.length) {
    return { error: "Categoria não encontrada ou é uma categoria fixa do plano de contas." };
  }
  return { conta: rows[0] };
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

// ---- Fechamento mensal -----------------------------------------------------
function monthRange(ano, mes) {
  const from = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const lastDay = new Date(ano, mes, 0).getDate();
  const to = `${ano}-${String(mes).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export async function getFechamentoMes(ano, mes) {
  const company = await getCompanyId();
  const { from, to } = monthRange(ano, mes);
  const dre = await getDRE({ from, to });
  // pendências do mês: lançamentos pendentes e confirmados sem conta.
  const pend = await finQuery(
    `select
        count(*) filter (where status='pending')::int as pendentes,
        count(*) filter (where status in ('confirmed','reconciled') and account_id is null)::int as sem_conta
       from fin.transactions
      where company_id=$1 and date >= $2 and date <= $3`,
    [company, from, to]
  );
  // Contas a pagar vencidas e ainda em aberto até o fim do mês. Vencida é
  // pendência de fechamento tanto quanto lançamento sem categoria.
  const contas = await finQuery(
    `select
        count(*) filter (where paid_at is null and due_date <= $3)::int as vencidas,
        count(*)::int as total
       from fin.bills_payable
      where company_id=$1 and due_date >= $2 and due_date <= $3`,
    [company, from, to]
  );

  const closed = company
    ? (await finQuery(`select closed_at, snapshot from fin.monthly_close where company_id=$1 and ano=$2 and mes=$3`, [company, ano, mes])).rows[0] || null
    : null;

  return {
    ano, mes, dre, closed,
    pendencias: {
      ...(pend.rows[0] || { pendentes: 0, sem_conta: 0 }),
      contas_vencidas: contas.rows[0]?.vencidas || 0,
      contas_total: contas.rows[0]?.total || 0,
      // Pendências do PÁTIO, não do caixa: carro vendido no mês sem nota
      // emitida ou sem data de saída. Antes o checklist só olhava lançamento,
      // e o mês fechava "limpo" com carro vendido e nota nenhuma.
      ...(await pendenciasDeVeiculos(from, to)),
    },
  };
}

/**
 * Pendências operacionais do mês que impedem o fechamento de ser confiável.
 *
 * Vive fora do schema `fin` (lê `public.vehicles` e `public.notas_fiscais`),
 * por isso usa `query` e não `finQuery` — a role do financeiro só LÊ o público,
 * e é justamente o que fazemos aqui.
 */
async function pendenciasDeVeiculos(from, to) {
  try {
    const { rows } = await query(
      `select
          count(*) filter (where v.data_saida is null)::int as vendidos_sem_data,
          count(*) filter (where n.id is null)::int as vendidos_sem_nota,
          count(*)::int as vendidos
         from public.vehicles v
         left join public.notas_fiscais n
           on n.vehicle_id = v.id and n.status in ('processando','autorizada')
        where v.status = 'vendido'
          and v.data_saida >= $1 and v.data_saida <= $2`,
      [from, to]
    );
    return rows[0] || { vendidos: 0, vendidos_sem_data: 0, vendidos_sem_nota: 0 };
  } catch (err) {
    // O checklist é um auxílio: se esta consulta falhar, o fechamento continua
    // funcionando com as pendências financeiras, em vez de quebrar a tela.
    // Mas o erro vai para o log — zero pendência por falha silenciosa é pior
    // que tela quebrada, porque o mês fecha parecendo limpo.
    console.error("Checklist de fechamento: falha ao ler pendências de veículos:", err);
    return { vendidos: 0, vendidos_sem_data: 0, vendidos_sem_nota: 0 };
  }
}

/**
 * Score de saúde financeira do ANO (módulo Planejamento).
 *
 * Reúne o que já existe espalhado — DRE, orçamento, contas a pagar, qualidade
 * dos lançamentos e margem dos carros — e entrega ao componente puro
 * `scoreSaudeFinanceira`, que faz a conta e explica cada pedaço.
 *
 * Componente sem dado vira `null` e SAI da conta em vez de valer zero: é por
 * isso que os campos de meta não são forçados a 0 aqui.
 */
export async function getSaudeFinanceira(ano) {
  const company = await getCompanyId();
  if (!company) return scoreSaudeFinanceira({});

  const from = `${ano}-01-01`;
  const to = `${ano}-12-31`;

  const dre = await getDRE({ from, to });

  const metas = await finQuery(
    `select coalesce(sum(receita_meta),0) as receita_meta,
            coalesce(sum(custo_meta),0) as custo_meta,
            coalesce(sum(despesa_meta),0) as despesa_meta
       from fin.budgets where company_id=$1 and ano=$2`,
    [company, ano]
  );

  const lanc = await finQuery(
    `select count(*)::int as total,
            count(*) filter (where status='pending')::int as pendentes,
            count(*) filter (where status in ('confirmed','reconciled') and account_id is null)::int as sem_conta
       from fin.transactions
      where company_id=$1 and date >= $2 and date <= $3`,
    [company, from, to]
  );

  // Vencidas: comparado com HOJE, não com o fim do ano — uma conta que vence em
  // dezembro não está vencida em agosto.
  const contas = await finQuery(
    `select count(*)::int as total,
            count(*) filter (where paid_at is null and due_date < current_date)::int as vencidas
       from fin.bills_payable
      where company_id=$1 and due_date >= $2 and due_date <= $3`,
    [company, from, to]
  );

  let vendidos = 0;
  let comLucro = 0;
  try {
    const margens = await getVehicleMargins({ onlyWithActivity: true });
    const vendidosComValor = margens.filter((m) => m.status === "vendido" && m.receita > 0);
    vendidos = vendidosComValor.length;
    comLucro = vendidosComValor.filter((m) => m.resultado_liquido > 0).length;
  } catch (err) {
    // Sem margens o componente fica "não avaliado" — melhor do que pontuar
    // zero e dizer que a loja vende no prejuízo.
    console.error("Saúde financeira: falha ao ler margens por veículo:", err);
  }

  const m = metas.rows[0] || {};
  const l = lanc.rows[0] || {};
  const c = contas.rows[0] || {};

  return scoreSaudeFinanceira({
    receita: dre.receita,
    lucroLiquido: dre.lucroLiquido,
    custos: dre.custos,
    despesas: dre.despesas,
    receitaMeta: Number(m.receita_meta) || 0,
    custoMeta: Number(m.custo_meta) || 0,
    despesaMeta: Number(m.despesa_meta) || 0,
    contasVencidas: c.vencidas || 0,
    contasTotal: c.total || 0,
    lancamentosPendentes: l.pendentes || 0,
    lancamentosSemConta: l.sem_conta || 0,
    lancamentosTotal: l.total || 0,
    veiculosVendidos: vendidos,
    veiculosComLucro: comLucro,
  });
}

export async function fecharMes(ano, mes, userId) {
  const company = await getCompanyId();
  const { dre } = await getFechamentoMes(ano, mes);
  await finQuery(
    `insert into fin.monthly_close (company_id, ano, mes, snapshot, closed_by)
       values ($1,$2,$3,$4::jsonb,$5)
     on conflict (company_id, ano, mes) do update set snapshot=excluded.snapshot, closed_by=excluded.closed_by, closed_at=now()`,
    [company, ano, mes, JSON.stringify(dre), userId || null]
  );
  return getFechamentoMes(ano, mes);
}

export async function reabrirMes(ano, mes) {
  const company = await getCompanyId();
  await finQuery(`delete from fin.monthly_close where company_id=$1 and ano=$2 and mes=$3`, [company, ano, mes]);
  return getFechamentoMes(ano, mes);
}

export async function listFechamentos() {
  const company = await getCompanyId();
  if (!company) return [];
  const { rows } = await finQuery(
    `select ano, mes, snapshot, closed_at from fin.monthly_close where company_id=$1 order by ano desc, mes desc`,
    [company]
  );
  return rows;
}

// ---- Orçamento -------------------------------------------------------------
export async function getOrcamento(ano) {
  const company = await getCompanyId();
  const meses = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    receita_meta: 0, custo_meta: 0, despesa_meta: 0,
    receita: 0, custos: 0, despesas: 0,
  }));
  if (!company) return meses;

  const metas = await finQuery(
    `select mes, receita_meta, custo_meta, despesa_meta from fin.budgets where company_id=$1 and ano=$2`,
    [company, ano]
  );
  for (const m of metas.rows) {
    const row = meses[m.mes - 1];
    row.receita_meta = Number(m.receita_meta);
    row.custo_meta = Number(m.custo_meta);
    row.despesa_meta = Number(m.despesa_meta);
  }

  // realizado por mês (regra do DRE: CMV = code 4x; despesa = restante).
  const real = await finQuery(
    `select extract(month from t.date)::int as mes,
            coalesce(sum(t.amount) filter (where t.type='revenue'),0) as receita,
            coalesce(sum(t.amount) filter (where t.type='expense' and a.code like '4%'),0) as custos,
            coalesce(sum(t.amount) filter (where t.type='expense' and (a.code is null or a.code not like '4%')),0) as despesas
       from fin.transactions t
       left join fin.chart_of_accounts a on a.id = t.account_id
      where t.company_id=$1 and extract(year from t.date)=$2 and t.status in ('confirmed','reconciled')
      group by 1`,
    [company, ano]
  );
  for (const r of real.rows) {
    const row = meses[r.mes - 1];
    row.receita = Number(r.receita);
    row.custos = Number(r.custos);
    row.despesas = Number(r.despesas);
  }
  return meses;
}

export async function saveOrcamentoMes(ano, mes, metas) {
  const company = await getCompanyId();
  await finQuery(
    `insert into fin.budgets (company_id, ano, mes, receita_meta, custo_meta, despesa_meta)
       values ($1,$2,$3,$4,$5,$6)
     on conflict (company_id, ano, mes) do update set
       receita_meta=excluded.receita_meta, custo_meta=excluded.custo_meta, despesa_meta=excluded.despesa_meta`,
    [company, ano, mes, Number(metas.receita_meta) || 0, Number(metas.custo_meta) || 0, Number(metas.despesa_meta) || 0]
  );
  return true;
}
