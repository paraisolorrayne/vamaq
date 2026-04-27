"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "../admin.module.css";

export default function EstoquePage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/vehicles")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setVehicles(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  async function handleDelete(id) {
    if (!confirm("Tem certeza que deseja excluir este veículo?")) return;
    await fetch(`/api/admin/vehicles/${id}`, { method: "DELETE" });
    setRefreshKey((k) => k + 1);
  }

  const filtered = vehicles.filter((v) =>
    `${v.brand} ${v.model} ${v.color}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Estoque</h1>
        <p className={styles.pageSubtitle}>
          Gerencie os veículos disponíveis no site
        </p>
      </div>

      <div
        className={styles.card}
        style={{ marginBottom: 24 }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            placeholder="Buscar por marca, modelo ou cor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.formInput}
            style={{ maxWidth: 360 }}
          />
          <Link href="/admin/estoque/novo" className={styles.btnPrimary}>
            + Novo Veículo
          </Link>
        </div>
      </div>

      <div className={styles.card}>
        {loading ? (
          <div className={styles.loading}>Carregando estoque...</div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🚗</div>
            <div className={styles.emptyText}>
              {search
                ? "Nenhum veículo encontrado para esta busca"
                : "Nenhum veículo cadastrado ainda"}
            </div>
            {!search && (
              <Link href="/admin/estoque/novo" className={styles.btnPrimary}>
                + Adicionar Primeiro Veículo
              </Link>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Foto</th>
                  <th>Veículo</th>
                  <th>Ano</th>
                  <th>Km</th>
                  <th>Cor</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id}>
                    <td>
                      {v.images?.main ? (
                        <img
                          src={v.images.main}
                          alt={`${v.brand} ${v.model}`}
                          className={styles.tableThumbnail}
                        />
                      ) : (
                        <div
                          className={styles.tableThumbnail}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.7rem",
                            color: "#999",
                          }}
                        >
                          Sem foto
                        </div>
                      )}
                    </td>
                    <td>
                      <strong>
                        {v.brand} {v.model}
                      </strong>
                    </td>
                    <td>{v.year}</td>
                    <td>{v.mileage?.toLocaleString("pt-BR")} km</td>
                    <td>{v.color}</td>
                    <td>
                      {v.featured ? (
                        <span className={styles.badgeSuccess}>Destaque</span>
                      ) : (
                        <span className={styles.badgeWarning}>Normal</span>
                      )}
                    </td>
                    <td>
                      <div className={styles.tableActions}>
                        <Link
                          href={`/admin/estoque/novo?id=${v.id}`}
                          className={`${styles.btnSecondary} ${styles.btnSmall}`}
                        >
                          Editar
                        </Link>
                        <button
                          onClick={() => handleDelete(v.id)}
                          className={styles.btnDanger}
                        >
                          Excluir
                        </button>
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
