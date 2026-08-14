"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "../../admin.module.css";
import { GRUPOS, partesDoCodigo } from "@/lib/fin/planoContas";

/**
 * Categorias de receita e despesa (plano de contas).
 *
 * A operadora escolhe o GRUPO em português e o código sai sozinho: o DRE e a
 * margem por veículo agrupam por prefixo de código, então digitar "5.1.7" à mão
 * é a forma mais fácil de pôr uma despesa no lugar errado do resultado sem
 * ninguém perceber.
 */

// A qual grupo pertence uma conta, pelo prefixo do código. O mais específico
// ganha: "4.2" tem que vencer "4" se um dia existir um grupo "4".
function grupoDaConta(conta) {
  const partes = partesDoCodigo(conta?.code);
  if (!partes) return null;
  let achado = null;
  for (const g of GRUPOS) {
    const base = partesDoCodigo(g.prefixo);
    if (!base || partes.length <= base.length) continue;
    if (!base.every((n, i) => partes[i] === n)) continue;
    if (!achado || base.length > partesDoCodigo(achado.prefixo).length) achado = g;
  }
  return achado;
}

export default function CategoriasPage() {
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState("");
  const [grupoId, setGrupoId] = useState("administrativa");
  const [salvando, setSalvando] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let ativo = true;
    fetch("/api/admin/financeiro/contas")
      .then((r) => r.json())
      .then((d) => { if (ativo) { setContas(Array.isArray(d) ? d : []); setLoading(false); } })
      .catch(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [reload]);

  async function criar(e) {
    e.preventDefault();
    setSalvando(true);
    setErr(null);
    setOk(null);
    try {
      const r = await fetch("/api/admin/financeiro/contas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, grupoId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(d.error || "Não foi possível criar a categoria.");
        return;
      }
      setOk(`"${d.name}" criada. Já aparece na hora de lançar.`);
      setNome("");
      setReload((n) => n + 1);
    } catch {
      setErr("Falha de conexão. Tente de novo.");
    } finally {
      // No finally: sem isto o botão fica travado para sempre quando o
      // servidor responde erro, e a operadora acha que o sistema morreu.
      setSalvando(false);
    }
  }

  async function alternar(conta) {
    setErr(null);
    setOk(null);
    const r = await fetch(`/api/admin/financeiro/contas/${conta.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !conta.ativo }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(d.error || "Não foi possível mudar a categoria.");
      return;
    }
    setReload((n) => n + 1);
  }

  const grupoSel = GRUPOS.find((g) => g.id === grupoId);

  return (
    <>
      <Link href="/admin/financeiro" className={styles.backLinkContent}>← Financeiro</Link>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Categorias</h1>
        <p className={styles.pageSubtitle}>
          As categorias que aparecem ao lançar uma receita ou despesa
        </p>
      </div>

      {err && (
        <div className={styles.card} style={{ marginBottom: 24, borderLeft: "4px solid #b91c1c" }}>
          <p style={{ color: "#b91c1c", fontSize: "0.9rem", margin: 0 }}>{err}</p>
        </div>
      )}
      {ok && (
        <div className={styles.card} style={{ marginBottom: 24, borderLeft: "4px solid #15803d" }}>
          <p style={{ color: "#15803d", fontSize: "0.9rem", margin: 0 }}>{ok}</p>
        </div>
      )}

      <form onSubmit={criar} className={styles.card} style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Criar uma categoria</h3>
        <div className={styles.formGrid}>
          <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
            <label className={styles.formLabel}>Nome da categoria *</label>
            <input
              className={styles.formInput}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="ex.: Manutenção do ar-condicionado"
              style={{ minHeight: 48 }}
              required
            />
          </div>
          <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
            <label className={styles.formLabel}>Onde ela entra *</label>
            <select
              className={styles.formSelect}
              value={grupoId}
              onChange={(e) => setGrupoId(e.target.value)}
              style={{ minHeight: 48 }}
            >
              {GRUPOS.map((g) => (
                <option key={g.id} value={g.id}>{g.rotulo}</option>
              ))}
            </select>
            {grupoSel && (
              <p style={{ fontSize: "0.8rem", color: "#666", margin: "6px 0 0" }}>{grupoSel.ajuda}</p>
            )}
          </div>
        </div>
        <div className={styles.formActions}>
          <button type="submit" className={styles.btnPrimary} disabled={salvando} style={{ minHeight: 48 }}>
            {salvando ? "Criando…" : "Criar categoria"}
          </button>
        </div>
      </form>

      <div className={styles.card}>
        {loading ? (
          <div className={styles.loading}>Carregando…</div>
        ) : (
          GRUPOS.map((g) => {
            const doGrupo = contas.filter((c) => grupoDaConta(c)?.id === g.id);
            if (!doGrupo.length) return null;
            return (
              <div key={g.id} style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 4px" }}>{g.rotulo}</h3>
                <p style={{ fontSize: "0.78rem", color: "#888", margin: "0 0 12px" }}>{g.ajuda}</p>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <tbody>
                      {doGrupo.map((c) => (
                        <tr key={c.id} style={{ opacity: c.ativo ? 1 : 0.55 }}>
                          <td style={{ width: 90, color: "#888", fontVariantNumeric: "tabular-nums" }}>
                            {c.code}
                          </td>
                          <td>
                            <strong>{c.name}</strong>
                            {!c.ativo && (
                              <span style={{ fontSize: "0.75rem", color: "#888" }}> · desativada</span>
                            )}
                          </td>
                          <td style={{ width: 170, textAlign: "right" }}>
                            {c.editable ? (
                              <button
                                type="button"
                                onClick={() => alternar(c)}
                                className={`${styles.btnSecondary} ${styles.btnSmall}`}
                                style={{ minHeight: 48 }}
                              >
                                {c.ativo ? "Desativar" : "Reativar"}
                              </button>
                            ) : (
                              <span style={{ fontSize: "0.75rem", color: "#888" }}>fixa do plano</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
        <p style={{ fontSize: "0.78rem", color: "#888", margin: 0 }}>
          Categoria desativada some da lista ao lançar, mas continua nos lançamentos que já
          existem — por isso nada é apagado. As categorias marcadas como <strong>fixas</strong> são
          as que o DRE e a margem por veículo usam para montar o resultado, e não podem ser
          desligadas.
        </p>
      </div>
    </>
  );
}
