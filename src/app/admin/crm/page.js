"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "../admin.module.css";
import crm from "./crm.module.css";
import { formatValorBR } from "@/lib/money";
import { anoVeiculo } from "@/lib/anoVeiculo";

function money(n) { return n != null ? "R$ " + formatValorBR(Number(n)) : "—"; }

const ETAPAS = [
  { key: "novo", label: "Novo" },
  { key: "contato", label: "Em contato" },
  { key: "proposta", label: "Proposta" },
  { key: "negociacao", label: "Negociação" },
  { key: "ganho", label: "Ganho" },
  { key: "perdido", label: "Perdido" },
];
const ORIGENS = ["WhatsApp", "Instagram", "Indicação", "Site", "Loja física", "Outro"];
const EMPTY = { cliente_nome: "", telefone: "", email: "", vehicle_id: "", valor: "", origem: "WhatsApp", obs: "" };

export default function CrmPage() {
  const [ops, setOps] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [reload, setReload] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/crm/oportunidades")
      .then((r) => r.json())
      .then((d) => { setOps(d.oportunidades || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load, reload]);
  useEffect(() => {
    fetch("/api/admin/vehicles").then((r) => r.json()).then((v) => setVehicles(Array.isArray(v) ? v : [])).catch(() => {});
  }, []);

  function set(f, v) { setForm((s) => ({ ...s, [f]: v })); }
  function openNew() { setForm(EMPTY); setEditId(null); setErr(null); setShowForm(true); }
  function openEdit(o) {
    setForm({ cliente_nome: o.cliente_nome, telefone: o.telefone || "", email: o.email || "", vehicle_id: o.vehicle_id || "", valor: o.valor != null ? formatValorBR(o.valor) : "", origem: o.origem || "WhatsApp", obs: o.obs || "" });
    setEditId(o.id); setErr(null); setShowForm(true);
  }

  async function save(e) {
    e.preventDefault(); setSaving(true); setErr(null);
    try {
      const res = editId
        ? await fetch(`/api/admin/crm/oportunidades/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
        : await fetch("/api/admin/crm/oportunidades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao salvar");
      setShowForm(false); setForm(EMPTY); setReload((n) => n + 1);
    } catch (e2) { setErr(e2.message); } finally { setSaving(false); }
  }

  async function move(o, etapa) {
    let motivo;
    if (etapa === "perdido") { motivo = prompt("Motivo da perda (opcional):") || ""; }
    const res = await fetch(`/api/admin/crm/oportunidades/${o.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ etapa, motivo_perda: motivo }) });
    if (res.ok) setReload((n) => n + 1);
  }
  async function registrarVenda(o) {
    if (!confirm(`Registrar a venda para ${o.cliente_nome}? O veículo será marcado como VENDIDO e sai do site.`)) return;
    const res = await fetch(`/api/admin/crm/oportunidades/${o.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "registrar-venda" }) });
    if (res.ok) { setReload((n) => n + 1); alert("Venda registrada. Lembre de lançar a receita no Financeiro (vinculada ao veículo, pra margem)."); }
  }
  async function remove(o) {
    if (!confirm(`Remover a oportunidade de ${o.cliente_nome}?`)) return;
    const res = await fetch(`/api/admin/crm/oportunidades/${o.id}`, { method: "DELETE" });
    if (res.ok) setReload((n) => n + 1);
  }

  const byEtapa = (k) => ops.filter((o) => o.etapa === k);
  const emAberto = ops.filter((o) => !["ganho", "perdido"].includes(o.etapa)).length;

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>CRM — Funil de vendas</h1>
        <p className={styles.pageSubtitle}>{emAberto} oportunidade(s) em aberto</p>
      </div>

      <div className={styles.card} style={{ marginBottom: 24 }}>
        <div className={styles.toolbar}>
          <button onClick={openNew} className={styles.btnPrimary} style={{ marginLeft: "auto" }}>+ Nova oportunidade</button>
        </div>
      </div>

      {showForm && (
        <div className={styles.card} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>{editId ? "Editar oportunidade" : "Nova oportunidade"}</h3>
          <form onSubmit={save} className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Cliente</label>
              <input className={styles.formInput} value={form.cliente_nome} onChange={(e) => set("cliente_nome", e.target.value)} placeholder="Nome do cliente" required />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Telefone / WhatsApp</label>
              <input className={styles.formInput} value={form.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(34) 90000-0000" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>E-mail</label>
              <input className={styles.formInput} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="cliente@email.com" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Veículo de interesse</label>
              <select className={styles.formSelect} value={form.vehicle_id} onChange={(e) => set("vehicle_id", e.target.value)}>
                <option value="">—</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} {anoVeiculo(v)}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Valor pretendido</label>
              <input className={styles.formInput} value={form.valor} onChange={(e) => set("valor", e.target.value)} placeholder="180.000,00" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Origem</label>
              <select className={styles.formSelect} value={form.origem} onChange={(e) => set("origem", e.target.value)}>
                {ORIGENS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label className={styles.formLabel}>Observações</label>
              <input className={styles.formInput} value={form.obs} onChange={(e) => set("obs", e.target.value)} placeholder="Ex: quer financiar em 48x, tem carro na troca…" />
            </div>
            {err && <p style={{ color: "#b91c1c", fontSize: "0.85rem", gridColumn: "1 / -1", margin: 0 }}>{err}</p>}
            <div className={`${styles.formGroup} ${styles.formGroupFull}`} style={{ display: "flex", gap: 12 }}>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
              <button type="button" className={styles.btnSecondary} onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Carregando…</div>
      ) : (
        <div className={crm.board}>
          {ETAPAS.map((et) => {
            const list = byEtapa(et.key);
            return (
              <div key={et.key} className={crm.column}>
                <div className={crm.colHead}>
                  <span className={crm.colTitle}>{et.label}</span>
                  <span className={crm.colCount}>{list.length}</span>
                </div>
                <div className={crm.cards}>
                  {list.map((o) => (
                    <div key={o.id} className={`${crm.card} ${o.etapa === "ganho" ? crm.ganho : ""} ${o.etapa === "perdido" ? crm.perdido : ""}`}>
                      <div className={crm.cardName}>{o.cliente_nome}</div>
                      <div className={crm.cardMeta}>
                        {o.vehicle_brand ? `${o.vehicle_brand} ${o.vehicle_model}` : "sem veículo"}
                        {o.origem ? ` · ${o.origem}` : ""}
                      </div>
                      {o.telefone && <div className={crm.cardMeta}>{o.telefone}</div>}
                      {o.valor != null && <div className={crm.cardValor}>{money(o.valor)}</div>}
                      {o.etapa === "perdido" && o.motivo_perda && <div className={crm.cardMeta}>Perda: {o.motivo_perda}</div>}
                      <div className={crm.cardFoot}>
                        <select className={crm.moveSelect} value={o.etapa} onChange={(e) => move(o, e.target.value)}>
                          {ETAPAS.map((e2) => <option key={e2.key} value={e2.key}>{e2.label}</option>)}
                        </select>
                        <button className={crm.iconBtn} onClick={() => openEdit(o)} title="Editar">✎</button>
                        <button className={crm.iconBtn} onClick={() => remove(o)} title="Remover">✕</button>
                      </div>
                      {o.etapa === "ganho" && o.vehicle_id && (
                        <button className={crm.sellBtn} onClick={() => registrarVenda(o)}>Registrar venda (marcar vendido)</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
