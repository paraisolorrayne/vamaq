"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "../admin.module.css";
import { DEFAULT_TEMPLATES } from "@/lib/contractTemplates";

export default function DocumentosPage() {
  const [templates] = useState(DEFAULT_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [values, setValues] = useState({});
  const [vehicles, setVehicles] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null);

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
      initial[f.key] = "";
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
      veiculo_km: v.mileage ? v.mileage.toLocaleString("pt-BR") : prev.veiculo_km,
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
          templateBody: selectedTemplate.body,
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
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const margin = 20;
    const pageWidth = 210 - margin * 2;
    const pageHeight = 297 - margin * 2;
    let y = margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    const titleLines = doc.splitTextToSize(preview.title, pageWidth);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 7 + 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const lines = preview.content.split("\n");
    for (const line of lines) {
      if (y > pageHeight + margin - 10) {
        doc.addPage();
        y = margin;
      }

      if (
        line.startsWith("CLÁUSULA") ||
        line.startsWith("VENDEDOR") ||
        line.startsWith("COMPRADOR") ||
        line.startsWith("CONSIGNANTE") ||
        line.startsWith("CONSIGNATÁRIA")
      ) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        y += 4;
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
      }

      const wrapped = doc.splitTextToSize(line, pageWidth);
      for (const wl of wrapped) {
        if (y > pageHeight + margin - 10) {
          doc.addPage();
          y = margin;
        }
        doc.text(wl, margin, y);
        y += 5;
      }
    }

    doc.save(`${preview.title.replace(/\s+/g, "_")}.pdf`);
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
              marginBottom: 24,
            }}
          >
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>
              Pré-visualização
            </h2>
            <div style={{ display: "flex", gap: 12 }}>
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
        </div>
      ) : (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
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
            <div className={styles.formGrid}>
              {selectedTemplate.fields.map((field) => (
                <div key={field.key} className={styles.formGroup}>
                  <label className={styles.formLabel}>{field.label}</label>
                  <input
                    type={field.type === "date" ? "date" : "text"}
                    value={values[field.key] || ""}
                    onChange={(e) =>
                      handleFieldChange(field.key, e.target.value)
                    }
                    className={styles.formInput}
                    placeholder={field.label}
                  />
                </div>
              ))}
            </div>

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
