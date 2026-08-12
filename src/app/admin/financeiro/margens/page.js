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
          <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Veículo</th><th>Receita</th><th>Custo total</th>
                  <th title="ICMS + PIS + COFINS da nota de venda, pelos mesmos parâmetros das notas autorizadas">Impostos da venda</th>
                  <th>Resultado líquido</th><th>Margem líq.</th>
                </tr>
              </thead>
              <tbody>
                {margens.map((m) => {
                  const liq = m.resultado_liquido ?? m.resultado;
                  const margem = m.receita > 0 ? (liq / m.receita) * 100 : 0;
                  return (
                    <tr key={m.vehicle_id}>
                      <td>
                        <strong>{m.brand} {m.model}</strong> {m.year}
                        <span style={{ display: "block", fontSize: "0.75rem", color: "#888" }}>
                          {m.placa || "sem placa"} · {m.status}
                        </span>
                      </td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{money(m.receita)}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{money(m.custo_total)}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums", color: "#a16207" }}>{money(m.impostos ?? m.icms)}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, color: liq >= 0 ? "#15803d" : "#b91c1c" }}>{money(liq)}</td>
                      <td style={{ color: margem >= 0 ? "#15803d" : "#b91c1c" }}>
                        {m.receita > 0 ? margem.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%" : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#888", marginTop: 12 }}>
            Impostos da venda de seminovo: base do ICMS = valor da venda com redução de 95,238%,
            alíquota 5%; PIS 0,65% e COFINS 3% sobre a base do ICMS menos o ICMS — os mesmos
            parâmetros das notas que a SEFAZ já autorizou. Resultado líquido = receita − custos −
            impostos.
          </p>
          </>
        )}
      </div>
    </>
  );
}
