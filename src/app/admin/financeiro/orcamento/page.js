"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "../../admin.module.css";
import { formatValorBR, parseValorBR } from "@/lib/money";

function money(n) { return "R$ " + formatValorBR(Number(n) || 0); }
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// cor do desvio: para receita, realizado ≥ meta é bom; para custo/despesa, ≤ meta é bom.
function corDesvio(realizado, meta, gastoBom) {
  if (!meta) return "#888";
  const dentro = gastoBom ? realizado <= meta * 1.05 : realizado >= meta * 0.95;
  return dentro ? "#15803d" : "#b91c1c";
}

export default function OrcamentoPage() {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [meses, setMeses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/financeiro/orcamento?ano=${ano}`)
      .then((r) => r.json())
      .then((d) => { if (active) { setMeses(d.meses || []); setLoading(false); } })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ano]);

  async function saveMes(mes, field, value) {
    const row = meses.find((m) => m.mes === mes);
    const body = {
      ano, mes,
      receita_meta: field === "receita_meta" ? value : row.receita_meta,
      custo_meta: field === "custo_meta" ? value : row.custo_meta,
      despesa_meta: field === "despesa_meta" ? value : row.despesa_meta,
    };
    await fetch("/api/admin/financeiro/orcamento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setMeses((ms) => ms.map((m) => (m.mes === mes ? { ...m, [field]: parseValorBR(value) || 0 } : m)));
  }

  const tot = meses.reduce((a, m) => ({
    rm: a.rm + m.receita_meta, r: a.r + m.receita,
    cm: a.cm + m.custo_meta, c: a.c + m.custos,
    dm: a.dm + m.despesa_meta, d: a.d + m.despesas,
  }), { rm: 0, r: 0, cm: 0, c: 0, dm: 0, d: 0 });

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Orçamento</h1>
        <p className={styles.pageSubtitle}>Metas mensais vs. realizado</p>
      </div>

      <div className={styles.card} style={{ marginBottom: 24 }}>
        <div className={styles.toolbar} style={{ gap: 10 }}>
          <Link href="/admin/financeiro" className={styles.btnSecondary}>← Financeiro</Link>
          <select className={styles.formSelect} value={ano} onChange={(e) => setAno(Number(e.target.value))} style={{ width: "auto", marginLeft: "auto" }}>
            {[now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.card}>
        {loading ? (
          <div className={styles.loading}>Carregando…</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table} style={{ fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th colSpan={2}>Receita (meta / real)</th>
                  <th colSpan={2}>Custos (meta / real)</th>
                  <th colSpan={2}>Despesas (meta / real)</th>
                </tr>
              </thead>
              <tbody>
                {meses.map((m) => (
                  <tr key={m.mes}>
                    <td><strong>{MESES[m.mes - 1]}</strong></td>
                    <td><MetaInput value={m.receita_meta} onSave={(v) => saveMes(m.mes, "receita_meta", v)} /></td>
                    <td style={{ color: corDesvio(m.receita, m.receita_meta, false) }}>{money(m.receita)}</td>
                    <td><MetaInput value={m.custo_meta} onSave={(v) => saveMes(m.mes, "custo_meta", v)} /></td>
                    <td style={{ color: corDesvio(m.custos, m.custo_meta, true) }}>{money(m.custos)}</td>
                    <td><MetaInput value={m.despesa_meta} onSave={(v) => saveMes(m.mes, "despesa_meta", v)} /></td>
                    <td style={{ color: corDesvio(m.despesas, m.despesa_meta, true) }}>{money(m.despesas)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, borderTop: "2px solid #ddd" }}>
                  <td>Ano</td>
                  <td>{money(tot.rm)}</td><td>{money(tot.r)}</td>
                  <td>{money(tot.cm)}</td><td>{money(tot.c)}</td>
                  <td>{money(tot.dm)}</td><td>{money(tot.d)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p style={{ fontSize: "0.78rem", color: "#888", marginTop: 12 }}>
          Digite as metas (elas salvam ao sair do campo). O realizado vem dos lançamentos confirmados.
          Verde = dentro da meta (receita acima, custos/despesas abaixo).
        </p>
      </div>
    </>
  );
}

function MetaInput({ value, onSave }) {
  // uncontrolled + key: reseta ao mudar o valor salvo, sem efeito de sincronização.
  return (
    <input
      key={value}
      defaultValue={value ? formatValorBR(value) : ""}
      onBlur={(e) => { if ((parseValorBR(e.target.value) || 0) !== value) onSave(e.target.value); }}
      placeholder="—"
      style={{ width: 100, padding: "3px 6px", fontSize: "0.82rem", border: "1px solid #d0d0d0", borderRadius: 6 }}
    />
  );
}
