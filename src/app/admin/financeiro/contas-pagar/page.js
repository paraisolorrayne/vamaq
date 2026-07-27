"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "../../admin.module.css";
import { formatValorBR } from "@/lib/money";

function money(n) { return "R$ " + formatValorBR(Number(n) || 0); }
function brDate(d) { return d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—"; }
function today() { return new Date().toISOString().slice(0, 10); }
const EMPTY = { description: "", value: "", due_date: today(), contact_id: "", account_id: "", cost_center_id: "" };

function situacao(b) {
  if (b.approval_status === "rejected") return { label: "Rejeitada", bg: "#f3f4f6", color: "#6b7280" };
  if (b.approval_status === "awaiting_approval") return { label: "Aguardando aprovação", bg: "#fef9c3", color: "#a16207" };
  if (b.paid_at) return { label: "Paga", bg: "#dcfce7", color: "#15803d" };
  if (b.due_date && b.due_date.slice(0, 10) < today()) return { label: "Vencida", bg: "#fee2e2", color: "#b91c1c" };
  return { label: "A vencer", bg: "#e0f2fe", color: "#0369a1" };
}

export default function ContasPagarPage() {
  const [bills, setBills] = useState([]);
  const [refs, setRefs] = useState({ accounts: [], costCenters: [], contacts: [] });
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [reload, setReload] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/financeiro/contas-pagar")
      .then((r) => r.json())
      .then((d) => { setBills(d.bills || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load, reload]);
  useEffect(() => {
    fetch("/api/admin/financeiro/referencias").then((r) => r.json()).then((d) =>
      setRefs({ accounts: (d.accounts || []).filter((a) => a.type === "expense"), costCenters: d.costCenters || [], contacts: d.contacts || [] })
    ).catch(() => {});
  }, []);

  function set(f, v) { setForm((s) => ({ ...s, [f]: v })); }

  async function save(e) {
    e.preventDefault(); setSaving(true); setErr(null);
    try {
      const res = await fetch("/api/admin/financeiro/contas-pagar", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao salvar");
      setShowForm(false); setForm(EMPTY); setReload((n) => n + 1);
    } catch (e2) { setErr(e2.message); } finally { setSaving(false); }
  }

  async function act(b, action) {
    if (action === "reject" && !confirm("Rejeitar esta conta?")) return;
    const res = await fetch(`/api/admin/financeiro/contas-pagar/${b.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Não foi possível"); return; }
    setReload((n) => n + 1);
  }
  async function remove(b) {
    if (!confirm("Remover esta conta?")) return;
    const res = await fetch(`/api/admin/financeiro/contas-pagar/${b.id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Não foi possível"); return; }
    setReload((n) => n + 1);
  }

  const totalAberto = bills.filter((b) => b.approval_status === "approved" && !b.paid_at).reduce((s, b) => s + b.value, 0);
  const aguardando = bills.filter((b) => b.approval_status === "awaiting_approval").length;

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Contas a pagar</h1>
        <p className={styles.pageSubtitle}>
          Em aberto (aprovadas): <strong>{money(totalAberto)}</strong>
          {aguardando > 0 && <> · <span style={{ color: "#a16207" }}>{aguardando} aguardando aprovação</span></>}
        </p>
      </div>

      <div className={styles.card} style={{ marginBottom: 24 }}>
        <div className={styles.toolbar}>
          <Link href="/admin/financeiro" className={styles.btnSecondary}>← Financeiro</Link>
          <button onClick={() => { setShowForm((s) => !s); setErr(null); }} className={styles.btnPrimary} style={{ marginLeft: "auto" }}>+ Nova conta</button>
        </div>
      </div>

      {showForm && (
        <div className={styles.card} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Nova conta a pagar</h3>
          <form onSubmit={save} className={styles.formGrid}>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label className={styles.formLabel}>Descrição</label>
              <input className={styles.formInput} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Ex: Aluguel de julho" required />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Valor</label>
              <input className={styles.formInput} value={form.value} onChange={(e) => set("value", e.target.value)} placeholder="3.000,00" required />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Vencimento</label>
              <input type="date" className={styles.formInput} value={form.due_date} onChange={(e) => set("due_date", e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Fornecedor</label>
              <select className={styles.formSelect} value={form.contact_id} onChange={(e) => set("contact_id", e.target.value)}>
                <option value="">—</option>
                {refs.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Conta (plano de contas)</label>
              <select className={styles.formSelect} value={form.account_id} onChange={(e) => set("account_id", e.target.value)}>
                <option value="">—</option>
                {refs.accounts.map((a) => <option key={a.id} value={a.id}>{a.code ? `${a.code} · ` : ""}{a.name}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Centro de custo</label>
              <select className={styles.formSelect} value={form.cost_center_id} onChange={(e) => set("cost_center_id", e.target.value)}>
                <option value="">—</option>
                {refs.costCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
        ) : bills.length === 0 ? (
          <div className={styles.emptyState}><div className={styles.emptyIcon}>📄</div><div className={styles.emptyText}>Nenhuma conta a pagar</div></div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Vencimento</th><th>Descrição</th><th>Fornecedor</th><th>Valor</th><th>Situação</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {bills.map((b) => {
                  const s = situacao(b);
                  return (
                    <tr key={b.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{brDate(b.due_date)}</td>
                      <td><strong>{b.description}</strong>{b.account_code && <span style={{ display: "block", fontSize: "0.75rem", color: "#888" }}>{b.account_code} · {b.account_name}</span>}</td>
                      <td style={{ fontSize: "0.85rem" }}>{b.contact_name || "—"}</td>
                      <td style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{money(b.value)}</td>
                      <td><span className={styles.badgeWarning} style={{ background: s.bg, color: s.color }}>{s.label}</span></td>
                      <td>
                        <div className={styles.tableActions}>
                          {b.approval_status === "awaiting_approval" && (
                            <>
                              <button onClick={() => act(b, "approve")} className={`${styles.btnSecondary} ${styles.btnSmall}`}>Aprovar</button>
                              <button onClick={() => act(b, "reject")} className={styles.btnDanger}>Rejeitar</button>
                            </>
                          )}
                          {b.approval_status === "approved" && !b.paid_at && (
                            <button onClick={() => act(b, "pay")} className={`${styles.btnPrimary} ${styles.btnSmall}`}>Marcar pago</button>
                          )}
                          {b.paid_at && (
                            <button onClick={() => act(b, "unpay")} className={`${styles.btnSecondary} ${styles.btnSmall}`}>Desfazer</button>
                          )}
                          {!b.paid_at && (
                            <button onClick={() => remove(b)} className={styles.btnDanger}>Remover</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
