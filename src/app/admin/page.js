"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./admin.module.css";

export default function AdminDashboard() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aprovar, setAprovar] = useState(null);

  useEffect(() => {
    fetch("/api/admin/vehicles")
      .then((r) => r.json())
      .then((data) => {
        setVehicles(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Contas esperando aprovação. Antes disto, a secretária cadastrava a conta,
  // ela ficava parada em "aguardando aprovação" e o gestor só descobria se
  // abrisse a tela por conta própria — a conta vencia sem ninguém errar nada.
  // Quem não enxerga o financeiro recebe 403 e o aviso simplesmente não aparece.
  useEffect(() => {
    let ativo = true;
    fetch("/api/admin/financeiro/contas-pagar")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!ativo || !d?.bills) return;
        const pendentes = d.bills.filter((b) => b.approval_status === "awaiting_approval");
        if (pendentes.length) {
          setAprovar({
            quantidade: pendentes.length,
            valor: pendentes.reduce((s, b) => s + Number(b.value || 0), 0),
          });
        }
      })
      .catch(() => {});
    return () => { ativo = false; };
  }, []);

  const totalVehicles = vehicles.length;
  const featuredCount = vehicles.filter((v) => v.featured).length;
  const brands = [...new Set(vehicles.map((v) => v.brand))].length;
  const withImages = vehicles.filter(
    (v) => v.images?.main && v.images.main !== ""
  ).length;

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Dashboard</h1>
        <p className={styles.pageSubtitle}>
          Visão geral do estoque e operações
        </p>
      </div>

      {aprovar && (
        <div
          className={styles.card}
          style={{ marginBottom: 24, borderLeft: "4px solid #a8752e", background: "#fff7e8" }}
        >
          <strong style={{ color: "#a8752e" }}>
            {aprovar.quantidade} conta{aprovar.quantidade === 1 ? "" : "s"} esperando sua aprovação
          </strong>
          <p style={{ fontSize: "0.9rem", color: "#666", margin: "6px 0 0" }}>
            Total de{" "}
            {aprovar.valor.toLocaleString("pt-BR", {
              style: "currency", currency: "BRL", minimumFractionDigits: 2,
            })}
            . Sem aprovação, a conta não pode ser marcada como paga.
          </p>
          <p style={{ margin: "14px 0 0" }}>
            <Link href="/admin/financeiro/contas-pagar" className={styles.btnPrimary} prefetch={false}>
              Ver contas a aprovar
            </Link>
          </p>
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Carregando...</div>
      ) : (
        <>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Total de Veículos</div>
              <div className={`${styles.statValue} ${styles.statAccent}`}>
                {totalVehicles}
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Em Destaque</div>
              <div className={styles.statValue}>{featuredCount}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Marcas</div>
              <div className={styles.statValue}>{brands}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Com Fotos</div>
              <div className={styles.statValue}>{withImages}</div>
            </div>
          </div>

          <div className={styles.card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>
                Ações Rápidas
              </h2>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/admin/estoque/novo" className={styles.btnPrimary}>
                + Adicionar Veículo
              </Link>
              <Link href="/admin/estoque" className={styles.btnSecondary}>
                Ver Estoque
              </Link>
              <Link href="/admin/documentos" className={styles.btnSecondary}>
                Gerar Documento
              </Link>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const placa = e.currentTarget.placa.value.trim();
                  if (placa) router.push(`/admin/estoque?busca=${encodeURIComponent(placa)}`);
                }}
                style={{ display: "flex", gap: 8 }}
              >
                <input
                  name="placa"
                  className={styles.formInput}
                  placeholder="Buscar por placa"
                  style={{ width: 180 }}
                />
                <button type="submit" className={styles.btnSecondary}>
                  Buscar
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}
