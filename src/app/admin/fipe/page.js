"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "../admin.module.css";

const VEHICLE_TYPES = [
  { value: "carros", label: "Carros e Utilitários" },
  { value: "motos", label: "Motos" },
  { value: "caminhoes", label: "Caminhões" },
];

export default function FipePage() {
  const [tipo, setTipo] = useState("carros");
  const [marcas, setMarcas] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [anos, setAnos] = useState([]);

  const [marcaSel, setMarcaSel] = useState("");
  const [modeloSel, setModeloSel] = useState("");
  const [anoSel, setAnoSel] = useState("");

  const [resultado, setResultado] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchFipe = useCallback(async (params) => {
    const qs = new URLSearchParams({ tipo, ...params }).toString();
    const res = await fetch(`/api/admin/fipe?${qs}`);
    if (!res.ok) throw new Error("Erro ao consultar FIPE");
    return res.json();
  }, [tipo]);

  useEffect(() => {
    setMarcas([]);
    setModelos([]);
    setAnos([]);
    setMarcaSel("");
    setModeloSel("");
    setAnoSel("");
    setResultado(null);
    setError("");

    fetchFipe({}).then(setMarcas).catch(() => setError("Erro ao carregar marcas"));
  }, [tipo, fetchFipe]);

  useEffect(() => {
    if (!marcaSel) {
      setModelos([]);
      setModeloSel("");
      setAnos([]);
      setAnoSel("");
      setResultado(null);
      return;
    }
    setModelos([]);
    setModeloSel("");
    setAnos([]);
    setAnoSel("");
    setResultado(null);
    setLoading(true);

    fetchFipe({ marca: marcaSel })
      .then((data) => setModelos(data.modelos || []))
      .catch(() => setError("Erro ao carregar modelos"))
      .finally(() => setLoading(false));
  }, [marcaSel, fetchFipe]);

  useEffect(() => {
    if (!modeloSel) {
      setAnos([]);
      setAnoSel("");
      setResultado(null);
      return;
    }
    setAnos([]);
    setAnoSel("");
    setResultado(null);
    setLoading(true);

    fetchFipe({ marca: marcaSel, modelo: modeloSel })
      .then(setAnos)
      .catch(() => setError("Erro ao carregar anos"))
      .finally(() => setLoading(false));
  }, [modeloSel, marcaSel, fetchFipe]);

  useEffect(() => {
    if (!anoSel) {
      setResultado(null);
      return;
    }
    setResultado(null);
    setLoading(true);
    setError("");

    fetchFipe({ marca: marcaSel, modelo: modeloSel, ano: anoSel })
      .then((data) => {
        setResultado(data);
        setHistorico((prev) => {
          const exists = prev.some(
            (h) => h.CodigoFipe === data.CodigoFipe && h.AnoModelo === data.AnoModelo
          );
          if (exists) return prev;
          return [data, ...prev].slice(0, 10);
        });
      })
      .catch(() => setError("Erro ao consultar preço"))
      .finally(() => setLoading(false));
  }, [anoSel, marcaSel, modeloSel, fetchFipe]);

  const marcaNome = marcas.find((m) => String(m.codigo) === marcaSel)?.nome || "";

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Consulta Tabela FIPE</h1>
        <p className={styles.pageSubtitle}>
          Consulte o preço de referência de veículos pela Tabela FIPE
        </p>
      </div>

      <div className={styles.card} style={{ marginBottom: 24 }}>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Tipo de Veículo</label>
            <select
              className={styles.formSelect}
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            >
              {VEHICLE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Marca</label>
            <select
              className={styles.formSelect}
              value={marcaSel}
              onChange={(e) => setMarcaSel(e.target.value)}
              disabled={marcas.length === 0}
            >
              <option value="">Selecione a marca...</option>
              {marcas.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Modelo</label>
            <select
              className={styles.formSelect}
              value={modeloSel}
              onChange={(e) => setModeloSel(e.target.value)}
              disabled={modelos.length === 0}
            >
              <option value="">
                {loading && !modelos.length ? "Carregando..." : "Selecione o modelo..."}
              </option>
              {modelos.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Ano / Combustível</label>
            <select
              className={styles.formSelect}
              value={anoSel}
              onChange={(e) => setAnoSel(e.target.value)}
              disabled={anos.length === 0}
            >
              <option value="">
                {loading && !anos.length ? "Carregando..." : "Selecione o ano..."}
              </option>
              {anos.map((a) => (
                <option key={a.codigo} value={a.codigo}>
                  {a.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p style={{ color: "#dc2626", marginTop: 16, fontSize: "0.85rem" }}>
            {error}
          </p>
        )}
      </div>

      {loading && !resultado && (
        <div className={styles.loading}>Consultando tabela FIPE...</div>
      )}

      {resultado && (
        <div className={styles.card} style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: "0.8rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                Valor FIPE
              </p>
              <p style={{ fontSize: "2.25rem", fontWeight: 700, color: "#ff6a00" }}>
                {resultado.Valor}
              </p>
            </div>
            <span className={styles.badgeSuccess}>
              {resultado.MesReferencia}
            </span>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>Marca</p>
              <p className={styles.statValue} style={{ fontSize: "1.25rem" }}>
                {resultado.Marca}
              </p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>Modelo</p>
              <p className={styles.statValue} style={{ fontSize: "1.25rem" }}>
                {resultado.Modelo}
              </p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>Ano</p>
              <p className={styles.statValue} style={{ fontSize: "1.25rem" }}>
                {resultado.AnoModelo}
              </p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>Combustível</p>
              <p className={styles.statValue} style={{ fontSize: "1.25rem" }}>
                {resultado.Combustivel}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 16, fontSize: "0.85rem", color: "#666" }}>
            <span>Código FIPE: <strong>{resultado.CodigoFipe}</strong></span>
            <span>Tipo: <strong>{resultado.TipoVeiculo === 1 ? "Carro" : resultado.TipoVeiculo === 2 ? "Moto" : "Caminhão"}</strong></span>
          </div>
        </div>
      )}

      {historico.length > 0 && (
        <div className={styles.card}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16, color: "#333" }}>
            Consultas Recentes
          </h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Marca</th>
                <th>Modelo</th>
                <th>Ano</th>
                <th>Combustível</th>
                <th>Código FIPE</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((h, i) => (
                <tr key={`${h.CodigoFipe}-${h.AnoModelo}-${i}`}>
                  <td>{h.Marca}</td>
                  <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {h.Modelo}
                  </td>
                  <td>{h.AnoModelo}</td>
                  <td>{h.Combustivel}</td>
                  <td><code style={{ fontSize: "0.8rem", background: "#f0f0f2", padding: "2px 6px", borderRadius: 4 }}>{h.CodigoFipe}</code></td>
                  <td style={{ fontWeight: 600, color: "#ff6a00" }}>{h.Valor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!resultado && !loading && marcaSel && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📊</div>
          <p className={styles.emptyText}>
            {!modeloSel
              ? `Selecione um modelo de ${marcaNome}`
              : !anoSel
              ? "Selecione o ano/combustível"
              : "Consultando..."}
          </p>
        </div>
      )}
    </>
  );
}
