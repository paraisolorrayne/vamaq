"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "../../admin.module.css";
import { hojeISO } from "@/lib/dataISO";
import NovaCategoria from "../NovaCategoria";
import { formatValorBR } from "@/lib/money";
import { anoVeiculo } from "@/lib/anoVeiculo";

function money(n) {
  return "R$ " + formatValorBR(Number(n) || 0);
}
const today = hojeISO;
const EMPTY = {
  date: today(),
  description: "",
  type: "expense",
  amount: "",
  account_id: "",
  cost_center_id: "",
  bank_account_id: "",
  contact_id: "",
  vehicle_id: "",
  status: "confirmed",
};

export default function LancamentosPage() {
  const [refs, setRefs] = useState({ accounts: [], costCenters: [], banks: [], contacts: [] });
  const [vehicles, setVehicles] = useState([]);
  const [list, setList] = useState({ rows: [], total: 0, page: 1 });
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [page, setPage] = useState(1);

  const loadList = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/financeiro/lancamentos?page=${page}`)
      .then((r) => r.json())
      .then((d) => { setList(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    fetch("/api/admin/financeiro/referencias").then((r) => r.json()).then(setRefs).catch(() => {});
    fetch("/api/admin/vehicles").then((r) => r.json()).then((v) => setVehicles(Array.isArray(v) ? v : [])).catch(() => {});
  }, []);
  useEffect(() => { loadList(); }, [loadList]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Categoria recém-criada entra na lista e já fica escolhida — criar e ter
  // que selecionar em seguida é o mesmo esquecimento com um passo a mais.
  function adicionarCategoria(conta) {
    setRefs((r) => ({ ...r, accounts: [...r.accounts, conta] }));
    set("account_id", conta.id);
  }
  function openNew() {
    setForm({ ...EMPTY, date: today() });
    setEditId(null);
    setErr(null);
    setShowForm(true);
  }
  function openEdit(tx) {
    setForm({
      date: tx.date?.slice(0, 10) || today(),
      description: tx.description || "",
      type: tx.type,
      amount: formatValorBR(tx.amount),
      account_id: tx.account_id || "",
      cost_center_id: tx.cost_center_id || "",
      bank_account_id: tx.bank_account_id || "",
      contact_id: tx.contact_id || "",
      vehicle_id: tx.vehicle_id || "",
      status: tx.status,
    });
    setEditId(tx.id);
    setErr(null);
    setShowForm(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const res = editId
        ? await fetch(`/api/admin/financeiro/lancamentos/${editId}`, {
            method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
          })
        : await fetch("/api/admin/financeiro/lancamentos", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao salvar");
      setShowForm(false);
      loadList();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm("Remover este lançamento?")) return;
    const res = await fetch(`/api/admin/financeiro/lancamentos/${id}`, { method: "DELETE" });
    if (res.ok) loadList();
  }

  const accountsByType = refs.accounts.filter((a) => a.type === form.type);
  const totalPages = Math.max(1, Math.ceil(list.total / (list.limit || 25)));

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Lançamentos</h1>
        <p className={styles.pageSubtitle}>Receitas e despesas — vincule ao veículo para ver a margem</p>
      </div>

      <div className={styles.card} style={{ marginBottom: 24 }}>
        <div className={styles.toolbar}>
          <Link href="/admin/financeiro" className={styles.btnSecondary}>← Financeiro</Link>
          <button onClick={openNew} className={styles.btnPrimary} style={{ marginLeft: "auto" }}>+ Novo lançamento</button>
        </div>
      </div>

      {showForm && (
        <div className={styles.card} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>
            {editId ? "Editar lançamento" : "Novo lançamento"}
          </h3>
          <form onSubmit={save} className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Tipo</label>
              <select className={styles.formSelect} value={form.type} onChange={(e) => set("type", e.target.value)}>
                <option value="expense">Despesa / Custo (saída)</option>
                <option value="revenue">Receita (entrada)</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Data</label>
              <input type="date" className={styles.formInput} value={form.date} onChange={(e) => set("date", e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Valor</label>
              <input className={styles.formInput} value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="150.000,00" required />
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label className={styles.formLabel}>Descrição</label>
              <input className={styles.formInput} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Ex: Compra do Audi Q5" required />
            </div>
            <div className={styles.formGroup}>
              {/* "Conta (plano de contas)" era o nome contábil. Quem lança
                  chama de categoria — e procurava por esse nome sem achar. */}
              <label className={styles.formLabel}>Categoria</label>
              <select className={styles.formSelect} value={form.account_id} onChange={(e) => set("account_id", e.target.value)}>
                <option value="">—</option>
                {accountsByType.map((a) => <option key={a.id} value={a.id}>{a.code ? `${a.code} · ` : ""}{a.name}</option>)}
              </select>
              <NovaCategoria tipo={form.type} onCriada={adicionarCategoria} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Centro de custo</label>
              <select className={styles.formSelect} value={form.cost_center_id} onChange={(e) => set("cost_center_id", e.target.value)}>
                <option value="">—</option>
                {refs.costCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Veículo (para margem)</label>
              <select className={styles.formSelect} value={form.vehicle_id} onChange={(e) => set("vehicle_id", e.target.value)}>
                <option value="">— nenhum —</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} {anoVeiculo(v)}{v.placa ? ` · ${v.placa}` : ""}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Conta bancária</label>
              <select className={styles.formSelect} value={form.bank_account_id} onChange={(e) => set("bank_account_id", e.target.value)}>
                <option value="">—</option>
                {refs.banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Contato</label>
              <select className={styles.formSelect} value={form.contact_id} onChange={(e) => set("contact_id", e.target.value)}>
                <option value="">—</option>
                {refs.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Situação</label>
              <select className={styles.formSelect} value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="confirmed">Confirmado</option>
                <option value="pending">Pendente</option>
              </select>
            </div>
            {err && <p style={{ color: "#b91c1c", fontSize: "0.85rem", gridColumn: "1 / -1", margin: 0 }}>{err}</p>}
            <div className={`${styles.formGroup} ${styles.formGroupFull}`} style={{ display: "flex", gap: 12 }}>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
              <button type="button" className={styles.btnSecondary} onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className={styles.card}>
        {loading ? (
          <div className={styles.loading}>Carregando…</div>
        ) : list.rows.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>💸</div>
            <div className={styles.emptyText}>Nenhum lançamento ainda</div>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Data</th><th>Descrição</th><th>Conta</th><th>Veículo</th><th>Valor</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {list.rows.map((t) => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{t.date?.slice(0, 10).split("-").reverse().join("/")}</td>
                    <td><strong>{t.description}</strong>{t.status === "pending" && <span className={styles.badgeWarning} style={{ marginLeft: 6, background: "#fef9c3", color: "#a16207" }}>pendente</span>}</td>
                    <td style={{ fontSize: "0.82rem", color: "#666" }}>{t.account_code ? `${t.account_code} · ` : ""}{t.account_name || "—"}</td>
                    <td style={{ fontSize: "0.82rem" }}>{t.vehicle_id ? `${t.vehicle_brand} ${t.vehicle_model}` : "—"}</td>
                    <td style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", color: t.type === "revenue" ? "#15803d" : "#b91c1c", fontWeight: 600 }}>
                      {t.type === "revenue" ? "+" : "−"} {money(t.amount)}
                    </td>
                    <td>
                      <div className={styles.tableActions}>
                        <button onClick={() => openEdit(t)} className={`${styles.btnSecondary} ${styles.btnSmall}`}>Editar</button>
                        <button onClick={() => remove(t.id)} className={styles.btnDanger}>Remover</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
            <button className={styles.btnSecondary} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>←</button>
            <span style={{ alignSelf: "center", fontSize: "0.85rem" }}>{page} / {totalPages}</span>
            <button className={styles.btnSecondary} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>→</button>
          </div>
        )}
      </div>
    </>
  );
}
