"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "../admin.module.css";
import { DEFAULT_TEMPLATES } from "@/lib/contractTemplates";
import { generateContractPdf, buildContractDoc } from "@/lib/contractPdf";

// Agrupa os campos por seção preservando a ordem de declaração do modelo.
function groupBySection(fields) {
  const groups = [];
  const byName = new Map();
  fields.forEach((f) => {
    const key = f.section || "";
    if (!byName.has(key)) {
      byName.set(key, []);
      groups.push([key, byName.get(key)]);
    }
    byName.get(key).push(f);
  });
  return groups;
}

export default function DocumentosPage() {
  const [templates] = useState(DEFAULT_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [values, setValues] = useState({});
  const [vehicles, setVehicles] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [viewMode, setViewMode] = useState("pdf"); // "pdf" | "texto"

  // Pré-visualização fiel: gera o PDF real (mesmo do "Baixar PDF") e exibe
  // num iframe. O texto puro fica disponível como visão alternativa.
  useEffect(() => {
    if (!preview) {
      setPdfUrl(null);
      return;
    }
    let cancelled = false;
    let url = null;
    buildContractDoc(preview)
      .then((doc) => {
        if (cancelled) return;
        url = doc.output("bloburl");
        setPdfUrl(String(url));
      })
      .catch(() => {
        if (!cancelled) setViewMode("texto");
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [preview]);

  useEffect(() => {
    fetch("/api/admin/vehicles")
      .then((r) => r.json())
      .then(setVehicles)
      .catch(() => {});
  }, []);

  const selectTemplate = useCallback((template) => {
    setSelectedTemplate(template);
    setPreview(null);
    const initial = {};
    template.fields.forEach((f) => {
      initial[f.key] = f.type === "select" ? f.options?.[0] || "" : "";
    });
    setValues(initial);
  }, []);

  function handleFieldChange(key, value) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function fillFromVehicle(vehicleId) {
    const v = vehicles.find((veh) => veh.id === vehicleId);
    if (!v) return;
    setValues((prev) => ({
      ...prev,
      veiculo_marca: v.brand || prev.veiculo_marca,
      veiculo_modelo: v.model || prev.veiculo_modelo,
      veiculo_ano: String(v.year) || prev.veiculo_ano,
      veiculo_cor: v.color || prev.veiculo_cor,
      veiculo_combustivel: v.fuel || prev.veiculo_combustivel,
      veiculo_km: v.quilometragem ? v.quilometragem.toLocaleString("pt-BR") : prev.veiculo_km,
    }));
  }

  async function handleGenerate() {
    if (!selectedTemplate) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // O corpo é montado conforme os dados (anuente opcional, favorecido
          // do pagamento, alienação fiduciária) — a API só preenche os campos.
          templateBody: selectedTemplate.build(values),
          values,
          title: selectedTemplate.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao gerar documento");
      }
      setPreview(data);
    } catch (err) {
      alert("Erro ao gerar documento: " + err.message);
    }
    setGenerating(false);
  }

  async function handleDownloadPdf() {
    if (!preview) return;
    try {
      await generateContractPdf(preview);
    } catch (err) {
      alert("Erro ao gerar PDF: " + err.message);
    }
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Documentos</h1>
        <p className={styles.pageSubtitle}>
          Gere contratos e documentos a partir de modelos prontos
        </p>
      </div>

      {!selectedTemplate ? (
        <div>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 16 }}>
            Selecione um Modelo
          </h2>
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {templates.map((t) => (
              <div
                key={t.id}
                className={styles.card}
                style={{ cursor: "pointer", transition: "box-shadow 0.2s" }}
                onClick={() => selectTemplate(t)}
                onMouseOver={(e) =>
                  (e.currentTarget.style.boxShadow =
                    "0 4px 20px rgba(0,0,0,0.1)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.boxShadow = "none")
                }
              >
                <div
                  style={{ fontSize: "2rem", marginBottom: 12 }}
                >
                  📋
                </div>
                <h3
                  style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 4 }}
                >
                  {t.name}
                </h3>
                <p style={{ fontSize: "0.85rem", color: "#666" }}>
                  {t.description}
                </p>
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "#999",
                    marginTop: 8,
                  }}
                >
                  {t.fields.length} campos a preencher
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : preview ? (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>
              Pré-visualização
            </h2>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={() =>
                  setViewMode((m) => (m === "pdf" ? "texto" : "pdf"))
                }
                className={styles.btnSecondary}
              >
                {viewMode === "pdf" ? "Ver texto puro" : "Ver documento"}
              </button>
              <button onClick={handleDownloadPdf} className={styles.btnPrimary}>
                Baixar PDF
              </button>
              <button
                onClick={() => setPreview(null)}
                className={styles.btnSecondary}
              >
                Editar Dados
              </button>
              <button
                onClick={() => {
                  setSelectedTemplate(null);
                  setPreview(null);
                }}
                className={styles.btnSecondary}
              >
                Novo Documento
              </button>
            </div>
          </div>
          {viewMode === "pdf" ? (
            pdfUrl ? (
              <iframe
                src={pdfUrl}
                title="Pré-visualização do contrato"
                style={{
                  width: "100%",
                  height: "78vh",
                  border: "1px solid #e5e5e5",
                  borderRadius: 12,
                  background: "#525659",
                }}
              />
            ) : (
              <div
                className={styles.card}
                style={{ padding: 48, textAlign: "center", color: "#999" }}
              >
                Gerando pré-visualização do documento…
              </div>
            )
          ) : (
            <div
              className={styles.card}
              style={{
                fontFamily: "'Courier New', monospace",
                fontSize: "0.85rem",
                lineHeight: 1.8,
                whiteSpace: "pre-wrap",
                maxHeight: "70vh",
                overflow: "auto",
                padding: 32,
              }}
            >
              {preview.content}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>
                {selectedTemplate.name}
              </h2>
              <p style={{ fontSize: "0.85rem", color: "#666" }}>
                Preencha os dados para gerar o documento
              </p>
            </div>
            <button
              onClick={() => setSelectedTemplate(null)}
              className={styles.btnSecondary}
            >
              ← Trocar Modelo
            </button>
          </div>

          {vehicles.length > 0 && (
            <div className={styles.card} style={{ marginBottom: 24 }}>
              <h3
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                Preencher dados do veículo automaticamente
              </h3>
              <select
                className={styles.formSelect}
                onChange={(e) => fillFromVehicle(e.target.value)}
                defaultValue=""
              >
                <option value="">Selecione um veículo do estoque...</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.brand} {v.model} {v.year} — {v.color}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.card}>
            {groupBySection(selectedTemplate.fields).map(([section, fields]) => (
              <div key={section || "geral"} style={{ marginBottom: 24 }}>
                {section && (
                  <h3
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "#b45309",
                      margin: "0 0 12px",
                      paddingBottom: 6,
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    {section}
                  </h3>
                )}
                <div className={styles.formGrid}>
                  {fields.map((field) => (
                    <div key={field.key} className={styles.formGroup}>
                      <label className={styles.formLabel}>{field.label}</label>
                      {field.type === "select" ? (
                        <select
                          value={values[field.key] || field.options?.[0] || ""}
                          onChange={(e) =>
                            handleFieldChange(field.key, e.target.value)
                          }
                          className={styles.formSelect}
                        >
                          {(field.options || []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type === "date" ? "date" : "text"}
                          value={values[field.key] || ""}
                          onChange={(e) =>
                            handleFieldChange(field.key, e.target.value)
                          }
                          className={styles.formInput}
                          placeholder={field.label}
                        />
                      )}
                      {field.hint && (
                        <p
                          style={{
                            fontSize: "0.72rem",
                            color: "#999",
                            margin: "4px 0 0",
                            lineHeight: 1.4,
                          }}
                        >
                          {field.hint}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className={styles.formActions}>
              <button
                onClick={handleGenerate}
                className={styles.btnPrimary}
                disabled={generating}
              >
                {generating ? "Gerando..." : "Gerar Documento"}
              </button>
              <button
                onClick={() => setSelectedTemplate(null)}
                className={styles.btnSecondary}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
