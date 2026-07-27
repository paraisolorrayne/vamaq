"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "../../admin.module.css";

const EMPTY = { name: "", doc: "", kind: "cliente", email: "", phone: "" };
const KIND_LABEL = { cliente: "Cliente", fornecedor: "Fornecedor", ambos: "Cliente e fornecedor" };

export default function ContatosPage() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/financeiro/contatos")
      .then((r) => r.json())
      .then((d) => { if (active) { setContacts(d.contacts || []); setLoading(false); } })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }
  function openNew() { setForm(EMPTY); setEditId(null); setErr(null); setShowForm(true); }
  function openEdit(c) {
    setForm({ name: c.name || "", doc: c.doc || "", kind: c.kind || "cliente", email: c.email || "", phone: c.phone || "" });
    setEditId(c.id); setErr(null); setShowForm(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const res = editId
        ? await fetch(`/api/admin/financeiro/contatos/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
        : await fetch("/api/admin/financeiro/contatos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao salvar");
      setShowForm(false);
      setReload((n) => n + 1);
    } catch (e2) { setErr(e2.message); } finally { setSaving(false); }
  }

  async function remove(c) {
    if (!confirm(`Remover o contato ${c.name}?`)) return;
    const res = await fetch(`/api/admin/financeiro/contatos/${c.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { alert(data.error || "Não foi possível remover"); return; }
    setReload((n) => n + 1);
  }

  const filtered = contacts.filter((c) =>
    `${c.name} ${c.doc || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Contatos</h1>
        <p className={styles.pageSubtitle}>Clientes e fornecedores — usados nas cobranças e lançamentos</p>
      </div>

      <div className={styles.card} style={{ marginBottom: 24 }}>
        <div className={styles.toolbar}>
          <Link href="/admin/financeiro" className={styles.btnSecondary}>← Financeiro</Link>
          <input
            className={`${styles.formInput} ${styles.toolbarSearch}`}
            placeholder="Buscar por nome ou CPF/CNPJ…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button onClick={openNew} className={styles.btnPrimary}>+ Novo contato</button>
        </div>
      </div>

      {showForm && (
        <div className={styles.card} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>
            {editId ? "Editar contato" : "Novo contato"}
          </h3>
          <form onSubmit={save} className={styles.formGrid}>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label className={styles.formLabel}>Nome / Razão social</label>
              <input className={styles.formInput} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: João da Silva" required />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>CPF / CNPJ</label>
              <input className={styles.formInput} value={form.doc} onChange={(e) => set("doc", e.target.value)} placeholder="Só números" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Tipo</label>
              <select className={styles.formSelect} value={form.kind} onChange={(e) => set("kind", e.target.value)}>
                <option value="cliente">Cliente</option>
                <option value="fornecedor">Fornecedor</option>
                <option value="ambos">Cliente e fornecedor</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>E-mail</label>
              <input className={styles.formInput} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="cliente@email.com" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Telefone</label>
              <input className={styles.formInput} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(34) 90000-0000" />
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
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>👤</div>
            <div className={styles.emptyText}>{search ? "Nenhum contato encontrado" : "Nenhum contato cadastrado ainda"}</div>
            {!search && <button onClick={openNew} className={styles.btnPrimary}>+ Cadastrar primeiro contato</button>}
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Nome</th><th>CPF/CNPJ</th><th>Tipo</th><th>Contato</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.doc || "—"}</td>
                    <td style={{ fontSize: "0.82rem", color: "#666" }}>{KIND_LABEL[c.kind] || c.kind}</td>
                    <td style={{ fontSize: "0.82rem" }}>{c.email || c.phone || "—"}</td>
                    <td>
                      <div className={styles.tableActions}>
                        <button onClick={() => openEdit(c)} className={`${styles.btnSecondary} ${styles.btnSmall}`}>Editar</button>
                        <button onClick={() => remove(c)} className={styles.btnDanger}>Remover</button>
                      </div>
                    </td>
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
