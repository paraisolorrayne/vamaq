"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "../../admin.module.css";
import { formatValorBR } from "@/lib/money";

function money(n) {
  return "R$ " + formatValorBR(Number(n) || 0);
}

export default function MargensPage() {
  const [margens, setMargens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/financeiro/margens?all=${all}`)
      .then((r) => r.json())
      .then((m) => { if (active) { setMargens(Array.isArray(m) ? m : []); setLoading(false); } })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [all]);

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Margem por veículo</h1>
        <p className={styles.pageSubtitle}>Receita − custo de cada carro, a partir dos lançamentos vinculados</p>
      </div>

      <div className={styles.card} style={{ marginBottom: 24 }}>
        <div className={styles.toolbar}>
          <Link href="/admin/financeiro" className={styles.btnSecondary}>← Financeiro</Link>
          <label className={styles.formCheckbox} style={{ marginLeft: "auto" }}>
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
            <span>Mostrar veículos sem lançamento</span>
          </label>
        </div>
      </div>

      <div className={styles.card}>
        {loading ? (
          <div className={styles.loading}>Carregando…</div>
        ) : margens.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🚗</div>
            <div className={styles.emptyText}>
              Nenhum veículo com lançamento. Vincule compras e vendas a um veículo nos Lançamentos.
            </div>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Veículo</th><th>Placa</th><th>Situação</th><th>Receita</th><th>Custo</th><th>Resultado</th><th>Margem</th></tr>
              </thead>
              <tbody>
                {margens.map((m) => {
                  const margem = m.receita > 0 ? (m.resultado / m.receita) * 100 : 0;
                  return (
                    <tr key={m.vehicle_id}>
                      <td><strong>{m.brand} {m.model}</strong> {m.year}</td>
                      <td>{m.placa || "—"}</td>
                      <td style={{ fontSize: "0.8rem", color: "#666" }}>{m.status}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{money(m.receita)}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{money(m.custo_total)}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, color: m.resultado >= 0 ? "#15803d" : "#b91c1c" }}>{money(m.resultado)}</td>
                      <td style={{ color: margem >= 0 ? "#15803d" : "#b91c1c" }}>
                        {m.receita > 0 ? margem.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%" : "—"}
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
