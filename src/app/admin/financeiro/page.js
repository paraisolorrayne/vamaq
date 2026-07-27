"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "../admin.module.css";
import { formatValorBR } from "@/lib/money";

function money(n) {
  return "R$ " + formatValorBR(Number(n) || 0);
}
function pct(n) {
  return (Number(n) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
}
function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export default function FinanceiroDashboard() {
  const [dre, setDre] = useState(null);
  const [margens, setMargens] = useState([]);
  const [loading, setLoading] = useState(true);
  const { from, to } = monthRange();

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/financeiro/dre?from=${from}&to=${to}`).then((r) => r.json()),
      fetch(`/api/admin/financeiro/margens`).then((r) => r.json()),
    ])
      .then(([d, m]) => {
        setDre(d);
        setMargens(Array.isArray(m) ? m : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [from, to]);

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Financeiro</h1>
        <p className={styles.pageSubtitle}>Resultado do mês e margem por veículo</p>
      </div>

      {loading ? (
        <div className={styles.loading}>Carregando…</div>
      ) : (
        <>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Receita (mês)</div>
              <div className={`${styles.statValue} ${styles.statAccent}`}>{money(dre?.receita)}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Custos (CMV)</div>
              <div className={styles.statValue}>{money(dre?.custos)}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Lucro Líquido</div>
              <div className={styles.statValue} style={{ color: (dre?.lucroLiquido || 0) >= 0 ? "#15803d" : "#b91c1c" }}>
                {money(dre?.lucroLiquido)}
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Margem Operacional</div>
              <div className={styles.statValue}>{pct(dre?.margemOperacional)}</div>
            </div>
          </div>

          {/* DRE resumido */}
          <div className={styles.card} style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>DRE do mês</h3>
              <Link href="/admin/financeiro/lancamentos" className={styles.btnPrimary}>+ Novo lançamento</Link>
            </div>
            <table className={styles.table}>
              <tbody>
                <DreRow label="Receita" value={dre?.receita} />
                <DreRow label="(−) Custos (CMV)" value={-(dre?.custos || 0)} />
                <DreRow label="= Lucro Bruto" value={dre?.lucroBruto} bold sub={`Margem bruta ${pct(dre?.margemBruta)}`} />
                <DreRow label="(−) Despesas operacionais" value={-(dre?.despesas || 0)} />
                <DreRow label="= Lucro Líquido" value={dre?.lucroLiquido} bold sub={`Margem operacional ${pct(dre?.margemOperacional)}`} />
              </tbody>
            </table>
          </div>

          {/* Margem por veículo (top) */}
          <div className={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>Margem por veículo</h3>
              <Link href="/admin/financeiro/margens" className={styles.btnSecondary}>Ver todos</Link>
            </div>
            {margens.length === 0 ? (
              <p style={{ color: "#666", fontSize: "0.9rem" }}>
                Nenhum lançamento vinculado a veículo ainda. Ao lançar uma compra ou venda,
                escolha o veículo para ver a margem dele aqui.
              </p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Veículo</th><th>Receita</th><th>Custo</th><th>Resultado</th></tr>
                  </thead>
                  <tbody>
                    {margens.slice(0, 8).map((m) => (
                      <tr key={m.vehicle_id}>
                        <td><strong>{m.brand} {m.model}</strong> {m.year}{m.placa ? ` · ${m.placa}` : ""}</td>
                        <td>{money(m.receita)}</td>
                        <td>{money(m.custo_total)}</td>
                        <td style={{ color: m.resultado >= 0 ? "#15803d" : "#b91c1c", fontWeight: 600 }}>{money(m.resultado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

function DreRow({ label, value, bold, sub }) {
  return (
    <tr>
      <td style={{ fontWeight: bold ? 700 : 400 }}>
        {label}
        {sub && <span style={{ display: "block", fontSize: "0.75rem", color: "#888", fontWeight: 400 }}>{sub}</span>}
      </td>
      <td style={{ textAlign: "right", fontWeight: bold ? 700 : 400, fontVariantNumeric: "tabular-nums" }}>
        {money(value)}
      </td>
    </tr>
  );
}
