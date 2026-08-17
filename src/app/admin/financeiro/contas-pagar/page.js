"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "../../admin.module.css";
import { hojeISO } from "@/lib/dataISO";
import NovaCategoria from "../NovaCategoria";
import { formatValorBR } from "@/lib/money";
import { leLinhaDigitavel } from "@/lib/fin/linhaDigitavel";
import { datasDaSerie, MAX_PARCELAS } from "@/lib/fin/recorrencia";

function money(n) { return "R$ " + formatValorBR(Number(n) || 0); }
function brDate(d) { return d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—"; }
const today = hojeISO;
const EMPTY = {
  description: "", value: "", due_date: today(), contact_id: "", account_id: "",
  cost_center_id: "", parcelas: 1, linha_digitavel: "",
};

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
  const [linha, setLinha] = useState("");
  const [linhaAviso, setLinhaAviso] = useState(null);
  const [anexando, setAnexando] = useState(null);
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

  // Categoria recém-criada entra na lista e já fica escolhida.
  function adicionarCategoria(conta) {
    setRefs((r) => ({ ...r, accounts: [...r.accounts, conta] }));
    set("account_id", conta.id);
  }

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

  // Lê a linha digitável e preenche valor e vencimento. Não sobrescreve o que
  // a operadora já digitou sem avisar — o aviso diz exatamente o que mudou.
  function aplicarLinha() {
    const r = leLinhaDigitavel(linha);
    if (r.error) {
      setLinhaAviso({ erro: true, texto: r.error });
      return;
    }
    // O que mudou é decidido AQUI, não dentro do setForm: o atualizador do
    // React roda depois, então um array preenchido lá dentro chega vazio na
    // montagem da mensagem — o valor aparecia no campo e a tela dizia "sem
    // valor legível". Visto em produção em 16/08/2026.
    const mudou = [];
    if (r.valor) mudou.push("valor");
    if (r.vencimento) mudou.push("vencimento");

    setForm((f) => ({
      ...f,
      linha_digitavel: linha.trim(),
      ...(r.valor
        ? { value: r.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
        : {}),
      ...(r.vencimento ? { due_date: r.vencimento } : {}),
    }));
    setLinhaAviso({
      erro: false,
      texto: mudou.length
        ? `${r.tipo === "boleto" ? "Boleto" : "Conta de concessionária"} reconhecido — ${mudou.join(" e ")} preenchido${mudou.length > 1 ? "s" : ""}. Confira antes de salvar.`
        : "Números conferidos, mas sem valor legível. Preencha à mão.",
    });
  }

  async function anexar(bill, file) {
    if (!file) return;
    setAnexando(bill.id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/admin/financeiro/contas-pagar/${bill.id}/anexo`, {
        method: "POST", body: fd,
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        alert(d.error || "Não foi possível anexar o arquivo.");
        return;
      }
      setReload((n) => n + 1);
    } finally {
      // No finally: sem isto o botão fica "Enviando…" para sempre quando o
      // upload falha, e a operadora acha que travou.
      setAnexando(null);
    }
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
            <div
              className={`${styles.formGroup} ${styles.formGroupFull}`}
              style={{ background: "#F7F7F8", padding: "12px 14px", borderRadius: 6 }}
            >
              <label className={styles.formLabel}>Linha digitável do boleto ou da conta</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  className={styles.formInput}
                  value={linha}
                  onChange={(e) => { setLinha(e.target.value); setLinhaAviso(null); }}
                  placeholder="Digite ou cole os números impressos abaixo do código de barras"
                  inputMode="numeric"
                  style={{ flex: "1 1 18rem", minHeight: 48 }}
                />
                <button
                  type="button"
                  onClick={aplicarLinha}
                  className={styles.btnSecondary}
                  disabled={!linha.trim()}
                  style={{ minHeight: 48 }}
                >
                  Ler conta
                </button>
              </div>
              <p
                style={{
                  fontSize: "0.8rem", margin: "6px 0 0",
                  color: linhaAviso ? (linhaAviso.erro ? "#b91c1c" : "#15803d") : "#666",
                }}
              >
                {linhaAviso
                  ? linhaAviso.texto
                  : "Opcional. Preenche o valor sozinho e confere se você digitou algum número trocado."}
              </p>
            </div>

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
              <label className={styles.formLabel}>Repetir mensalmente</label>
              <select
                className={styles.formSelect}
                value={form.parcelas}
                onChange={(e) => set("parcelas", Number(e.target.value))}
              >
                <option value={1}>Não repetir — conta avulsa</option>
                {[3, 6, 12, MAX_PARCELAS].map((n) => (
                  <option key={n} value={n}>por {n} meses</option>
                ))}
              </select>
              {form.parcelas > 1 && (
                <p style={{ fontSize: "0.8rem", color: "#666", margin: "6px 0 0" }}>
                  Cria {form.parcelas} contas de uma vez, do primeiro vencimento até{" "}
                  {(() => {
                    const d = datasDaSerie(form.due_date, form.parcelas);
                    if (!d.length) return "—";
                    const [a, m, dia] = d[d.length - 1].split("-");
                    return `${dia}/${m}/${a}`;
                  })()}
                  . O valor de cada mês é uma previsão — edite quando a conta chegar.
                </p>
              )}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Fornecedor</label>
              <select className={styles.formSelect} value={form.contact_id} onChange={(e) => set("contact_id", e.target.value)}>
                <option value="">—</option>
                {refs.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              {/* "Conta (plano de contas)" era o nome contábil. Quem cadastra
                  a conta a pagar chama de categoria. */}
              <label className={styles.formLabel}>Categoria</label>
              <select className={styles.formSelect} value={form.account_id} onChange={(e) => set("account_id", e.target.value)}>
                <option value="">—</option>
                {refs.accounts.map((a) => <option key={a.id} value={a.id}>{a.code ? `${a.code} · ` : ""}{a.name}</option>)}
              </select>
              {/* Só despesa: esta tela lista contas a PAGAR, e refs.accounts
                  já vem filtrado por type === "expense". */}
              <NovaCategoria tipo="expense" onCriada={adicionarCategoria} />
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
                      <td>
                        <strong>{b.description}</strong>
                        {b.account_code && (
                          <span style={{ display: "block", fontSize: "0.75rem", color: "#888" }}>
                            {b.account_code} · {b.account_name}
                          </span>
                        )}
                        {b.serie_id && (
                          <span style={{ display: "block", fontSize: "0.72rem", color: "#a8752e" }}>
                            conta mensal · {b.serie_total} parcelas
                          </span>
                        )}
                      </td>
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
                          {b.anexo?.arquivo ? (
                            <a
                              href={`/api/admin/financeiro/contas-pagar/${b.id}/anexo`}
                              target="_blank"
                              rel="noopener"
                              className={`${styles.btnSecondary} ${styles.btnSmall}`}
                            >
                              Ver anexo
                            </a>
                          ) : (
                            <label
                              className={`${styles.btnSecondary} ${styles.btnSmall}`}
                              style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}
                            >
                              {anexando === b.id ? "Enviando…" : "Anexar"}
                              {/* capture="environment" abre a câmera direto no
                                  celular — é como a conta de papel entra. */}
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,image/*,application/pdf"
                                capture="environment"
                                onChange={(e) => { anexar(b, e.target.files?.[0]); e.target.value = ""; }}
                                disabled={anexando === b.id}
                                style={{ display: "none" }}
                              />
                            </label>
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
