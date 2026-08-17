"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "../../admin.module.css";
import { hojeISO } from "@/lib/dataISO";
import { formatValorBR } from "@/lib/money";
import { anoVeiculo } from "@/lib/anoVeiculo";

function money(n) {
  return "R$ " + formatValorBR(Number(n) || 0);
}
function brDate(d) {
  return d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—";
}
const today = hojeISO;
const EMPTY = { contact_id: "", name: "", cpfCnpj: "", email: "", billingType: "BOLETO", value: "", dueDate: today(), description: "", vehicle_id: "" };

const STATUS_STYLE = {
  "A vencer": { background: "#fef9c3", color: "#a16207" },
  Recebida: { background: "#dcfce7", color: "#15803d" },
  "Recebida (dinheiro)": { background: "#dcfce7", color: "#15803d" },
  Vencida: { background: "#fee2e2", color: "#b91c1c" },
};

export default function CobrancasPage() {
  const [enabled, setEnabled] = useState(true);
  const [cobrancas, setCobrancas] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/financeiro/cobrancas")
      .then((r) => r.json())
      .then((d) => { setEnabled(d.enabled); setCobrancas(d.cobrancas || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/admin/financeiro/referencias").then((r) => r.json()).then((d) => setContacts(d.contacts || [])).catch(() => {});
    fetch("/api/admin/vehicles").then((r) => r.json()).then((v) => setVehicles(Array.isArray(v) ? v : [])).catch(() => {});
  }, []);

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function save(e) {
    e.preventDefault();
    setSaving(true); setErr(null); setResult(null);
    try {
      const res = await fetch("/api/admin/financeiro/cobrancas", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao emitir");
      setResult(data);
      setShowForm(false);
      setForm(EMPTY);
      load();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Cobranças</h1>
        <p className={styles.pageSubtitle}>Boletos e PIX pela integração Asaas</p>
      </div>

      {!enabled && (
        <div className={styles.card} style={{ marginBottom: 24, borderLeft: "4px solid #e8b84b", background: "#fff7e8" }}>
          <strong style={{ color: "#a8752e" }}>Integração Asaas ainda não ativada</strong>
          <p style={{ fontSize: "0.9rem", color: "#666", margin: "6px 0 0" }}>
            A tela está pronta. Para emitir boletos/PIX, ative o Asaas (chave da conta) —
            passo a passo em <code>docs/INTEGRACAO-ASAAS.md</code>. Enquanto isso, as cobranças
            que chegarem pelo webhook aparecem aqui.
          </p>
        </div>
      )}

      <div className={styles.card} style={{ marginBottom: 24 }}>
        <div className={styles.toolbar}>
          <Link href="/admin/financeiro" className={styles.btnSecondary}>← Financeiro</Link>
          <button
            onClick={() => { setShowForm((s) => !s); setResult(null); setErr(null); }}
            className={styles.btnPrimary}
            style={{ marginLeft: "auto" }}
            disabled={!enabled}
            title={enabled ? "" : "Ative o Asaas para emitir cobranças"}
          >
            + Nova cobrança
          </button>
        </div>
      </div>

      {result && (
        <div className={styles.card} style={{ marginBottom: 24, borderLeft: "4px solid #16a34a" }}>
          <strong style={{ color: "#15803d" }}>Cobrança criada!</strong>
          {result.invoiceUrl && (
            <p style={{ margin: "6px 0 0", fontSize: "0.9rem" }}>
              Link da fatura:{" "}
              <a href={result.invoiceUrl} target="_blank" rel="noopener noreferrer">{result.invoiceUrl}</a>
            </p>
          )}
        </div>
      )}

      {showForm && enabled && (
        <div className={styles.card} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Nova cobrança</h3>
          <form onSubmit={save} className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                Cliente (contato salvo){" "}
                <Link href="/admin/financeiro/contatos" style={{ fontWeight: 400, fontSize: "0.78rem" }}>+ cadastrar</Link>
              </label>
              <select className={styles.formSelect} value={form.contact_id} onChange={(e) => set("contact_id", e.target.value)}>
                <option value="">— ou preencha abaixo —</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nome (se não for contato salvo)</label>
              <input className={styles.formInput} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nome do cliente" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>CPF/CNPJ</label>
              <input className={styles.formInput} value={form.cpfCnpj} onChange={(e) => set("cpfCnpj", e.target.value)} placeholder="Só números" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>E-mail</label>
              <input className={styles.formInput} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="cliente@email.com" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Tipo</label>
              <select className={styles.formSelect} value={form.billingType} onChange={(e) => set("billingType", e.target.value)}>
                <option value="BOLETO">Boleto</option>
                <option value="PIX">PIX</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Valor</label>
              <input className={styles.formInput} value={form.value} onChange={(e) => set("value", e.target.value)} placeholder="5.000,00" required />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Vencimento</label>
              <input type="date" className={styles.formInput} value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Veículo (opcional)</label>
              <select className={styles.formSelect} value={form.vehicle_id} onChange={(e) => set("vehicle_id", e.target.value)}>
                <option value="">—</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} {anoVeiculo(v)}</option>)}
              </select>
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label className={styles.formLabel}>Descrição</label>
              <input className={styles.formInput} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Ex: Sinal do Audi Q5" />
            </div>
            {err && <p style={{ color: "#b91c1c", fontSize: "0.85rem", gridColumn: "1 / -1", margin: 0 }}>{err}</p>}
            <div className={`${styles.formGroup} ${styles.formGroupFull}`} style={{ display: "flex", gap: 12 }}>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>{saving ? "Emitindo…" : "Emitir cobrança"}</button>
              <button type="button" className={styles.btnSecondary} onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className={styles.card}>
        {loading ? (
          <div className={styles.loading}>Carregando…</div>
        ) : cobrancas.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🧾</div>
            <div className={styles.emptyText}>Nenhuma cobrança ainda</div>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Vencimento</th><th>Cliente</th><th>Tipo</th><th>Veículo</th><th>Valor</th><th>Situação</th><th></th></tr>
              </thead>
              <tbody>
                {cobrancas.map((c) => (
                  <tr key={c.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{brDate(c.due_date)}</td>
                    <td>{c.contact_name || "—"}</td>
                    <td>{c.billing_type || "—"}</td>
                    <td style={{ fontSize: "0.82rem" }}>{c.vehicle_brand ? `${c.vehicle_brand} ${c.vehicle_model}` : "—"}</td>
                    <td style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{money(c.value)}</td>
                    <td><span className={styles.badgeWarning} style={STATUS_STYLE[c.status_label] || {}}>{c.status_label}</span></td>
                    <td>{c.invoice_url && <a href={c.invoice_url} target="_blank" rel="noopener noreferrer" className={`${styles.btnSecondary} ${styles.btnSmall}`}>Fatura</a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
