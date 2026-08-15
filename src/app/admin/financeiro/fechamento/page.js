"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "../../admin.module.css";
import { formatValorBR } from "@/lib/money";

function money(n) { return "R$ " + formatValorBR(Number(n) || 0); }
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function FechamentoPage() {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/financeiro/fechamento?ano=${ano}&mes=${mes}`)
      .then((r) => r.json())
      .then((d) => { if (active) { setData(d); setLoading(false); } })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ano, mes]);

  async function acao(action) {
    if (action === "reabrir" && !confirm("Reabrir o mês? O fechamento anterior é descartado.")) return;
    setBusy(true);
    const res = await fetch("/api/admin/financeiro/fechamento", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ano, mes, action }),
    });
    if (res.ok) setData(await res.json());
    setBusy(false);
  }

  const dre = data?.dre;
  const pend = data?.pendencias || {};
  const closed = data?.closed;
  // O checklist agora cobre caixa E pátio: um mês pode estar impecável nos
  // lançamentos e ter carro vendido sem nota emitida.
  const itens = [
    pend.pendentes > 0 && {
      texto: `${pend.pendentes} lançamento(s) pendente(s) — ficam fora dos números até serem confirmados`,
      link: "/admin/financeiro/lancamentos",
    },
    pend.sem_conta > 0 && {
      texto: `${pend.sem_conta} lançamento(s) confirmado(s) sem categoria no plano de contas`,
      link: "/admin/financeiro/lancamentos",
    },
    pend.contas_vencidas > 0 && {
      texto: `${pend.contas_vencidas} conta(s) a pagar vencida(s) e ainda em aberto`,
      link: "/admin/financeiro/contas-pagar",
    },
    pend.vendidos_sem_nota > 0 && {
      texto: `${pend.vendidos_sem_nota} veículo(s) vendido(s) no mês sem nota fiscal emitida`,
      link: "/admin/fiscal",
    },
    pend.vendidos_sem_data > 0 && {
      texto: `${pend.vendidos_sem_data} veículo(s) vendido(s) sem data de saída preenchida`,
      link: "/admin/estoque/entradas-saidas",
    },
  ].filter(Boolean);
  const totalPend = itens.length;

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Fechamento mensal</h1>
        <p className={styles.pageSubtitle}>Feche o mês com o retrato do resultado — sem travar lançamentos</p>
      </div>

      <div className={styles.card} style={{ marginBottom: 24 }}>
        <div className={styles.toolbar} style={{ gap: 10, flexWrap: "wrap" }}>
          <Link href="/admin/financeiro" className={styles.btnSecondary}>← Financeiro</Link>
          <select className={styles.formSelect} value={mes} onChange={(e) => setMes(Number(e.target.value))} style={{ width: "auto" }}>
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select className={styles.formSelect} value={ano} onChange={(e) => setAno(Number(e.target.value))} style={{ width: "auto" }}>
            {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Carregando…</div>
      ) : (
        <>
          {closed && (
            <div className={styles.card} style={{ marginBottom: 24, borderLeft: "4px solid #16a34a", background: "#f0fdf4" }}>
              <strong style={{ color: "#15803d" }}>✓ Mês fechado</strong>
              <span style={{ color: "#666", fontSize: "0.9rem" }}> em {new Date(closed.closed_at).toLocaleDateString("pt-BR")}</span>
            </div>
          )}

          <div className={styles.statsGrid} style={{ marginBottom: 24 }}>
            <div className={styles.statCard}><div className={styles.statLabel}>Receita</div><div className={`${styles.statValue} ${styles.statAccent}`}>{money(dre?.receita)}</div></div>
            <div className={styles.statCard}><div className={styles.statLabel}>Custos (CMV)</div><div className={styles.statValue}>{money(dre?.custos)}</div></div>
            <div className={styles.statCard}><div className={styles.statLabel}>Despesas</div><div className={styles.statValue}>{money(dre?.despesas)}</div></div>
            <div className={styles.statCard}><div className={styles.statLabel}>Lucro líquido</div><div className={styles.statValue} style={{ color: (dre?.lucroLiquido || 0) >= 0 ? "#15803d" : "#b91c1c" }}>{money(dre?.lucroLiquido)}</div></div>
          </div>

          <div className={styles.card}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12 }}>Checklist de pendências</h3>
            {totalPend === 0 ? (
              <p style={{ color: "#15803d", fontSize: "0.9rem" }}>✓ Nenhuma pendência neste mês.</p>
            ) : (
              <ul style={{ paddingLeft: 20, fontSize: "0.9rem", color: "#333", margin: 0 }}>
                {itens.map((i) => (
                  <li key={i.texto} style={{ marginBottom: 6 }}>
                    {i.texto} —{" "}
                    <Link href={i.link} prefetch={false}>resolver</Link>
                  </li>
                ))}
              </ul>
            )}
            <p style={{ fontSize: "0.8rem", color: "#888", marginTop: 8 }}>
              Fechar o mês é um marco gerencial — você pode fechar mesmo com pendências, e lançamentos retroativos continuam permitidos.
            </p>
            <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
              {closed ? (
                <button className={styles.btnSecondary} onClick={() => acao("reabrir")} disabled={busy}>Reabrir mês</button>
              ) : (
                <button className={styles.btnPrimary} onClick={() => acao("fechar")} disabled={busy}>{busy ? "Fechando…" : `Fechar ${MESES[mes - 1]}/${ano}`}</button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
