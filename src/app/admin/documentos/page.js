"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "../admin.module.css";
import { DEFAULT_TEMPLATES } from "@/lib/contractTemplates";
import { clienteDoDocumento } from "@/lib/documentosCliente";
import { generateContractPdf, buildContractDoc } from "@/lib/contractPdf";
import { camposDoTemplate, prefixoDoTemplate } from "@/lib/clientes/prefill";
import { formataDoc } from "@/lib/clientes/doc";
import { anoVeiculo } from "@/lib/anoVeiculo";

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
  // Rascunhos de uso único vindos de /api/admin/prefill: abrem o modelo já
  // preenchido e são apagados do servidor quando o PDF é baixado.
  const [prefills, setPrefills] = useState([]);
  const [activePrefillId, setActivePrefillId] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [viewMode, setViewMode] = useState("pdf"); // "pdf" | "texto"
  const [vehicleIdSel, setVehicleIdSel] = useState("");
  const [avisoCopia, setAvisoCopia] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [clienteIdSel, setClienteIdSel] = useState("");
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [avisoCliente, setAvisoCliente] = useState(null); // { tipo: "erro" | "sucesso", texto }
  // Contrato que está sendo corrigido (veio de ?corrigir=<id>). O documento
  // antigo NÃO é apagado — a correção é um contrato novo que aponta para ele.
  const [corrigindo, setCorrigindo] = useState(null);
  const [erroCorrecao, setErroCorrecao] = useState(null);

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
    fetch("/api/admin/prefill")
      .then((r) => r.json())
      .then((data) => setPrefills(data.prefills || []))
      .catch(() => {});
    fetch("/api/admin/clientes")
      .then((r) => r.json())
      .then((d) => setClientes(d.clientes || []))
      .catch(() => {});
  }, []);

  // Abrir um contrato já gerado para CORRIGIR: /admin/documentos?corrigir=<id>.
  //
  // A Mayra gerou um contrato, viu que a chave reserva estava errada e teve que
  // preencher a minuta inteira de novo. Aqui os campos voltam como estavam e
  // ela troca só o que mudou.
  //
  // O `setState` acontece só dentro do .then — chamar direto no corpo do efeito
  // é o que a regra react-hooks/set-state-in-effect recusa.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("corrigir");
    if (!id) return;
    let cancelado = false;

    fetch(`/api/admin/documentos-gerados/${encodeURIComponent(id)}/dados`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Não foi possível abrir este contrato.");
        return d.documento;
      })
      .then((doc) => {
        if (cancelado || !doc) return;
        const template = DEFAULT_TEMPLATES.find((t) => t.id === doc.tipo);
        if (!template) throw new Error("O modelo deste contrato não existe mais.");
        const inicial = {};
        template.fields.forEach((f) => {
          inicial[f.key] = f.type === "select" ? f.options?.[0] || "" : "";
        });
        setSelectedTemplate(template);
        setPreview(null);
        setValues({ ...inicial, ...doc.dados });
        setVehicleIdSel(doc.vehicle_id || "");
        setClienteIdSel(doc.cliente_id || "");
        setCorrigindo({ id: doc.id, titulo: doc.titulo, created_at: doc.created_at });
      })
      .catch((e) => {
        if (!cancelado) setErroCorrecao(e.message);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  const selectTemplate = useCallback((template) => {
    setSelectedTemplate(template);
    setPreview(null);
    setActivePrefillId(null);
    // Trocar de modelo abandona a correção: os campos não são os mesmos.
    setCorrigindo(null);
    setErroCorrecao(null);
    setVehicleIdSel("");
    setClienteIdSel("");
    setAvisoCliente(null);
    const initial = {};
    template.fields.forEach((f) => {
      initial[f.key] = f.type === "select" ? f.options?.[0] || "" : "";
    });
    setValues(initial);
  }, []);

  function openPrefill(prefill) {
    const template = templates.find((t) => t.id === prefill.templateId);
    if (!template) return;
    const initial = {};
    template.fields.forEach((f) => {
      initial[f.key] = f.type === "select" ? f.options?.[0] || "" : "";
    });
    setSelectedTemplate(template);
    setPreview(null);
    setVehicleIdSel("");
    setClienteIdSel("");
    setAvisoCliente(null);
    setValues({ ...initial, ...prefill.values });
    setActivePrefillId(prefill.id);
  }

  function handleFieldChange(key, value) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function fillFromCliente(id) {
    setClienteIdSel(id || "");
    const cliente = clientes.find((c) => c.id === id);
    if (!cliente) return;
    setValues((prev) => ({ ...prev, ...camposDoTemplate(selectedTemplate.id, cliente) }));
  }

  async function salvarComoCliente() {
    const p = prefixoDoTemplate(selectedTemplate.id);
    const novo = {
      nome: values[`${p}_nome`],
      doc: values[`${p}_cpf`],
      cnh: values[`${p}_cnh`],
      cnh_categoria: values[`${p}_cnh_categoria`],
      telefone: values[`${p}_telefone`],
      email: values[`${p}_email`],
    };
    setSalvandoCliente(true);
    setAvisoCliente(null);
    try {
      const res = await fetch("/api/admin/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(novo),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setAvisoCliente({
          tipo: "erro",
          texto: "Você não tem permissão para cadastrar clientes — peça à secretaria.",
        });
      } else if (!res.ok) {
        setAvisoCliente({ tipo: "erro", texto: data.error || "Erro ao cadastrar cliente." });
      } else {
        setClientes((prev) => [...prev, data.cliente]);
        setClienteIdSel(data.cliente.id);
        setAvisoCliente({ tipo: "sucesso", texto: "Cliente cadastrado." });
      }
    } catch {
      setAvisoCliente({ tipo: "erro", texto: "Erro ao cadastrar cliente." });
    }
    setSalvandoCliente(false);
  }

  // `prefix` escolhe qual ficha recebe os dados: veiculo (padrão) ou troca
  // (veículo do estoque dado pela Vamaq como pagamento na compra e venda).
  function fillFromVehicle(vehicleId, prefix = "veiculo") {
    if (prefix === "veiculo") setVehicleIdSel(vehicleId || "");
    const v = vehicles.find((veh) => veh.id === vehicleId);
    if (!v) return;
    setValues((prev) => ({
      ...prev,
      [`${prefix}_marca`]: v.brand || prev[`${prefix}_marca`],
      [`${prefix}_modelo`]: v.model || prev[`${prefix}_modelo`],
      [`${prefix}_ano`]: anoVeiculo(v) || prev[`${prefix}_ano`],
      [`${prefix}_cor`]: v.color || prev[`${prefix}_cor`],
      [`${prefix}_combustivel`]: v.fuel || prev[`${prefix}_combustivel`],
      [`${prefix}_km`]: v.quilometragem
        ? v.quilometragem.toLocaleString("pt-BR")
        : prev[`${prefix}_km`],
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
    let blob;
    try {
      blob = await generateContractPdf(preview);
    } catch (err) {
      alert("Erro ao gerar PDF: " + err.message);
      return;
    }

    // O download já aconteceu. Guardar a cópia no servidor é o passo seguinte e
    // NUNCA pode derrubar a geração do contrato — falhou, o operador é avisado
    // e segue com o arquivo na mão.
    setAvisoCopia(null);
    try {
      const fd = new FormData();
      fd.set("file", blob, "contrato.pdf");
      fd.set("tipo", selectedTemplate.id);
      fd.set("titulo", preview.title);
      const cliente = clienteDoDocumento(selectedTemplate.id, values);
      if (cliente) fd.set("cliente", cliente);
      if (vehicleIdSel) fd.set("vehicleId", vehicleIdSel);
      if (clienteIdSel) fd.set("clienteId", clienteIdSel);
      // Os campos digitados vão junto: é o que permite corrigir uma linha do
      // contrato depois sem preencher a minuta inteira de novo.
      fd.set("dados", JSON.stringify(values));
      if (corrigindo) fd.set("corrigeDocumentoId", corrigindo.id);
      const res = await fetch("/api/admin/documentos-gerados", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
    } catch {
      setAvisoCopia(
        "O PDF foi baixado, mas não deu para guardar a cópia no sistema. Guarde o arquivo e avise o suporte."
      );
    }

    // A correção terminou: o contrato novo foi gerado e guardado. Sair do modo
    // evita que um segundo download crie outra correção do mesmo original.
    setCorrigindo(null);

    // Rascunho de uso único: baixou o PDF, o rascunho sai da edição.
    if (activePrefillId) {
      const id = activePrefillId;
      setActivePrefillId(null);
      setPrefills((prev) => prev.filter((p) => p.id !== id));
      fetch(`/api/admin/prefill?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }).catch(() => {});
    }
  }

  return (
    <>
      <div
        className={styles.pageHeader}
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h1 className={styles.pageTitle}>Documentos</h1>
          <p className={styles.pageSubtitle}>
            Gere contratos e documentos a partir de modelos prontos
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin/documentos/gerados" className={styles.btnSecondary}>
            Documentos gerados
          </Link>
          <Link href="/admin/tutoriais/documentos" className={styles.btnSecondary}>
            📖 Como usar
          </Link>
        </div>
      </div>

      {erroCorrecao && (
        <div
          className={styles.card}
          style={{ borderLeft: "4px solid #b91c1c", marginBottom: 20 }}
        >
          <strong style={{ color: "#b91c1c" }}>Não deu para abrir o contrato para correção</strong>
          <p style={{ margin: "6px 0 0", fontSize: "0.9rem", color: "#333" }}>
            {erroCorrecao} Contratos gerados antes de 18/08/2026 não guardaram os
            campos preenchidos — nesses, o jeito é preencher um novo.
          </p>
        </div>
      )}

      {corrigindo && (
        <div
          className={styles.card}
          style={{ borderLeft: "4px solid #2f4d8f", marginBottom: 20 }}
        >
          <strong>Corrigindo um contrato já gerado</strong>
          <p style={{ margin: "6px 0 0", fontSize: "0.9rem", color: "#333" }}>
            Os campos abaixo vieram de <strong>{corrigindo.titulo}</strong>, gerado em{" "}
            {new Date(corrigindo.created_at).toLocaleDateString("pt-BR")}. Troque o
            que precisa e gere de novo.
          </p>
          <p style={{ margin: "6px 0 0", fontSize: "0.85rem", color: "#666" }}>
            O contrato antigo continua guardado — ele é prova de que existiu. O novo
            entra na lista apontando para ele. Se o antigo já foi impresso, assinado
            ou enviado para assinatura, destrua ou cancele aquela via: quem vale é a
            que for assinada.
          </p>
        </div>
      )}

      {!selectedTemplate ? (
        <div>
          {prefills.map((p) => (
            <div
              key={p.id}
              className={styles.card}
              style={{
                borderLeft: "4px solid #FF6A00",
                marginBottom: 20,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 240, flex: 1 }}>
                <div
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "#FF6A00",
                    marginBottom: 4,
                  }}
                >
                  Contrato pronto para edição · uso único
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 600 }}>
                  {p.label || "Contrato pré-preenchido"}
                </div>
                {p.note && (
                  <p style={{ fontSize: "0.85rem", color: "#666", marginTop: 4 }}>
                    {p.note}
                  </p>
                )}
                <p style={{ fontSize: "0.8rem", color: "#888", marginTop: 4 }}>
                  Depois de clicar em &quot;Baixar PDF&quot;, este rascunho é
                  removido daqui automaticamente.
                </p>
              </div>
              <button onClick={() => openPrefill(p)} className={styles.btnPrimary}>
                Abrir para edição
              </button>
            </div>
          ))}
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
          {avisoCopia && (
            <p style={{ color: "#a16207", fontSize: "0.85rem" }}>{avisoCopia}</p>
          )}
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

          <div className={styles.card} style={{ marginBottom: 24 }}>
            <h3
              style={{
                fontSize: "0.9rem",
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              Preencher dados do cliente automaticamente
            </h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {clientes.length > 0 ? (
                <select
                  className={styles.formSelect}
                  value={clienteIdSel}
                  onChange={(e) => fillFromCliente(e.target.value)}
                  style={{ flex: 1, minWidth: 240 }}
                >
                  <option value="">Selecione um cliente cadastrado...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}{c.doc ? ` — ${formataDoc(c.doc)}` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <p style={{ fontSize: "0.85rem", color: "#666", margin: 0, flex: 1 }}>
                  Nenhum cliente cadastrado ainda.
                </p>
              )}
              <button
                onClick={salvarComoCliente}
                className={styles.btnSecondary}
                disabled={salvandoCliente}
              >
                {salvandoCliente ? "Salvando..." : "Salvar como cliente"}
              </button>
            </div>
            {avisoCliente && (
              <p
                style={{
                  fontSize: "0.8rem",
                  marginTop: 8,
                  marginBottom: 0,
                  color: avisoCliente.tipo === "erro" ? "#b91c1c" : "#15803d",
                }}
              >
                {avisoCliente.texto}
              </p>
            )}
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
                    {v.brand} {v.model} {anoVeiculo(v)} — {v.color}
                  </option>
                ))}
              </select>
              {/* Só na compra o veículo da troca sai do estoque (é o carro que a
                  Vamaq dá como pagamento). Na venda, os veículos da troca são do
                  cliente e vêm dos CRLVs dele. */}
              {selectedTemplate.id === "compra-venda" && (
                <select
                  className={styles.formSelect}
                  onChange={(e) => fillFromVehicle(e.target.value, "troca")}
                  defaultValue=""
                  style={{ marginTop: 8 }}
                >
                  <option value="">
                    Veículo dado na troca — selecione do estoque...
                  </option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.brand} {v.model} {anoVeiculo(v)} — {v.color}
                    </option>
                  ))}
                </select>
              )}
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
                    <div
                      key={field.key}
                      className={`${styles.formGroup} ${
                        field.type === "textarea" ? styles.formGroupFull : ""
                      }`}
                    >
                      <label className={styles.formLabel}>{field.label}</label>
                      {field.type === "textarea" ? (
                        <textarea
                          value={values[field.key] || ""}
                          onChange={(e) =>
                            handleFieldChange(field.key, e.target.value)
                          }
                          className={styles.formInput}
                          rows={4}
                          placeholder={field.label}
                          style={{ resize: "vertical", fontFamily: "inherit" }}
                        />
                      ) : field.type === "select" ? (
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
