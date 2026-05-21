"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./admin.module.css";

export default function AdminDashboard() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/vehicles")
      .then((r) => r.json())
      .then((data) => {
        setVehicles(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
            </div>
          </div>
        </>
      )}
    </>
  );
}
