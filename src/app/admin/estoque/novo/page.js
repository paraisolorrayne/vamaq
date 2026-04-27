"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import styles from "../../admin.module.css";

const FUEL_OPTIONS = ["Gasolina", "Diesel", "Flex", "Elétrico", "Híbrido"];
const BODY_OPTIONS = ["Sedan", "Coupé", "SUV", "Hatch", "Conversível", "Picape"];
const BADGE_OPTIONS = ["", "Novo", "Destaque", "Blindado"];
const TRANSMISSION_OPTIONS = ["Automático", "Manual", "CVT", "Automatizado"];

const EMPTY_VEHICLE = {
  brand: "",
  model: "",
  year: new Date().getFullYear(),
  price: "",
  quilometragem: "",
  fuel: "Gasolina",
  transmission: "Automático",
  power: "",
  color: "",
  bodyType: "Sedan",
  featured: false,
  badge: "",
  opcionais: [],
  blindagem: { blindado: false, tipo: "" },
  description: "",
  specs: { engine: "", acceleration: "", topSpeed: "", doors: 4, seats: 5 },
  images: { main: "", gallery: [] },
};

export default function NovoVeiculoPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Carregando...</div>}>
      <NovoVeiculoForm />
    </Suspense>
  );
}

function NovoVeiculoForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const fileInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const [form, setForm] = useState(EMPTY_VEHICLE);
  const [uploadCount, setUploadCount] = useState(0);
  const uploading = uploadCount > 0;
  const [removeBg, setRemoveBg] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    fetch(`/api/admin/vehicles/${editId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data && !data.error) {
          setForm({
            ...EMPTY_VEHICLE,
            ...data,
            price: data.price || "",
            quilometragem: data.quilometragem ?? "",
            badge: data.badge || "",
          });
        }
        setLoadingEdit(false);
      })
      .catch(() => {
        if (!cancelled) setLoadingEdit(false);
      });
    return () => { cancelled = true; };
  }, [editId]);

  const handleChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSpecChange = useCallback((field, value) => {
    setForm((prev) => ({
      ...prev,
      specs: { ...prev.specs, [field]: value },
    }));
  }, []);

  async function uploadImage(file, isMain) {
    setUploadCount((c) => c + 1);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("removeBg", removeBg ? "true" : "false");

      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();

      if (data.url) {
        setForm((prev) => {
          if (isMain) {
            return { ...prev, images: { ...prev.images, main: data.url } };
          }
          return {
            ...prev,
            images: {
              ...prev.images,
              gallery: [...prev.images.gallery, data.url],
            },
          };
        });
      }
    } catch (err) {
      alert("Erro ao fazer upload: " + err.message);
    }
    setUploadCount((c) => c - 1);
  }

  function handleMainDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) uploadImage(file, true);
  }

  function handleGalleryDrop(e) {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files) {
      Array.from(files).forEach((f) => uploadImage(f, false));
    }
  }

  function removeGalleryImage(idx) {
    setForm((prev) => ({
      ...prev,
      images: {
        ...prev.images,
        gallery: prev.images.gallery.filter((_, i) => i !== idx),
      },
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      ...form,
      price: form.price ? Number(form.price) : null,
      quilometragem: Number(form.quilometragem) || 0,
      badge: form.badge || null,
      specs: {
        ...form.specs,
        doors: Number(form.specs.doors) || 4,
        seats: Number(form.specs.seats) || 5,
      },
    };

    try {
      const res = editId
        ? await fetch(`/api/admin/vehicles/${editId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/vehicles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Erro ao salvar veículo");
      }
      router.push("/admin/estoque");
    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    }
    setSaving(false);
  }

  if (loadingEdit) {
    return <div className={styles.loading}>Carregando veículo...</div>;
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          {editId ? "Editar Veículo" : "Novo Veículo"}
        </h1>
        <p className={styles.pageSubtitle}>
          {editId
            ? "Atualize as informações do veículo"
            : "Cadastre um novo veículo no estoque"}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Image Upload Section */}
        <div className={styles.card} style={{ marginBottom: 24 }}>
          <h3
            style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}
          >
            Fotos do Veículo
          </h3>

          <div className={styles.toggleRow} style={{ marginBottom: 16 }}>
            <label className={styles.formCheckbox}>
              <input
                type="checkbox"
                checked={removeBg}
                onChange={(e) => setRemoveBg(e.target.checked)}
              />
              <span>Remover fundo e aplicar branco gelo automaticamente</span>
            </label>
          </div>

          <p
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "#555",
              marginBottom: 8,
            }}
          >
            FOTO PRINCIPAL
          </p>
          <div
            className={`${styles.uploadZone} ${uploading ? styles.uploadZoneActive : ""}`}
            onDrop={(e) => handleMainDrop(e)}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            {form.images.main ? (
              <div>
                <img
                  src={form.images.main}
                  alt="Principal"
                  style={{
                    maxWidth: 300,
                    maxHeight: 200,
                    borderRadius: 8,
                    margin: "0 auto",
                  }}
                />
                <p style={{ marginTop: 8, fontSize: "0.8rem", color: "#666" }}>
                  Clique ou arraste para substituir
                </p>
              </div>
            ) : (
              <>
                <div className={styles.uploadIcon}>📸</div>
                <div className={styles.uploadText}>
                  {uploading
                    ? "Processando imagem..."
                    : "Arraste a foto principal ou clique para selecionar"}
                </div>
                <div className={styles.uploadHint}>
                  JPG, PNG ou WebP — máx. 10MB
                </div>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadImage(f, true);
            }}
          />

          <p
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "#555",
              marginBottom: 8,
              marginTop: 24,
            }}
          >
            GALERIA (OPCIONAL)
          </p>
          <div
            className={styles.uploadZone}
            onDrop={(e) => handleGalleryDrop(e)}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => galleryInputRef.current?.click()}
          >
            <div className={styles.uploadIcon}>🖼️</div>
            <div className={styles.uploadText}>
              Arraste fotos adicionais ou clique para selecionar
            </div>
          </div>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              Array.from(e.target.files || []).forEach((f) =>
                uploadImage(f, false)
              );
            }}
          />

          {form.images.gallery.length > 0 && (
            <div className={styles.uploadPreview}>
              {form.images.gallery.map((url, idx) => (
                <div key={idx} className={styles.uploadPreviewItem}>
                  <img
                    src={url}
                    alt={`Galeria ${idx + 1}`}
                    className={styles.uploadPreviewImg}
                  />
                  <button
                    type="button"
                    className={styles.uploadPreviewRemove}
                    onClick={() => removeGalleryImage(idx)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vehicle Info */}
        <div className={styles.card} style={{ marginBottom: 24 }}>
          <h3
            style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}
          >
            Informações do Veículo
          </h3>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Marca *</label>
              <input
                type="text"
                value={form.brand}
                onChange={(e) => handleChange("brand", e.target.value)}
                className={styles.formInput}
                placeholder="Ex: Porsche"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Modelo *</label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => handleChange("model", e.target.value)}
                className={styles.formInput}
                placeholder="Ex: 911 Carrera GTS"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Ano *</label>
              <input
                type="number"
                value={form.year}
                onChange={(e) => handleChange("year", e.target.value)}
                className={styles.formInput}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Preço (R$)</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => handleChange("price", e.target.value)}
                className={styles.formInput}
                placeholder="Deixe vazio para 'Sob Consulta'"
              />
              <FipePriceLookup
                brand={form.brand}
                onApplyPrice={(price) => handleChange("price", price)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Quilometragem</label>
              <input
                type="number"
                value={form.quilometragem}
                onChange={(e) => handleChange("quilometragem", e.target.value)}
                className={styles.formInput}
                placeholder="Ex: 12000"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Cor</label>
              <input
                type="text"
                value={form.color}
                onChange={(e) => handleChange("color", e.target.value)}
                className={styles.formInput}
                placeholder="Ex: Preto"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Combustível</label>
              <select
                value={form.fuel}
                onChange={(e) => handleChange("fuel", e.target.value)}
                className={styles.formSelect}
              >
                {FUEL_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Transmissão</label>
              <select
                value={form.transmission}
                onChange={(e) => handleChange("transmission", e.target.value)}
                className={styles.formSelect}
              >
                {TRANSMISSION_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Potência</label>
              <input
                type="text"
                value={form.power}
                onChange={(e) => handleChange("power", e.target.value)}
                className={styles.formInput}
                placeholder="Ex: 480 cv"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Tipo de Carroceria</label>
              <select
                value={form.bodyType}
                onChange={(e) => handleChange("bodyType", e.target.value)}
                className={styles.formSelect}
              >
                {BODY_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Badge</label>
              <select
                value={form.badge}
                onChange={(e) => handleChange("badge", e.target.value)}
                className={styles.formSelect}
              >
                {BADGE_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b || "Nenhum"}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formCheckbox}>
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => handleChange("featured", e.target.checked)}
                />
                <span>Exibir na vitrine (destaque na home)</span>
              </label>
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label className={styles.formLabel}>Descrição</label>
              <textarea
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
                className={styles.formTextarea}
                placeholder="Descrição detalhada do veículo..."
                rows={4}
              />
            </div>
          </div>
        </div>

        {/* Blindagem */}
        <div className={styles.card} style={{ marginBottom: 24 }}>
          <h3
            style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}
          >
            Blindagem
          </h3>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formCheckbox}>
                <input
                  type="checkbox"
                  checked={form.blindagem?.blindado || false}
                  onChange={(e) =>
                    handleChange("blindagem", {
                      ...form.blindagem,
                      blindado: e.target.checked,
                    })
                  }
                />
                <span>Veículo blindado</span>
              </label>
            </div>
            {form.blindagem?.blindado && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Tipo de Blindagem</label>
                <input
                  type="text"
                  value={form.blindagem?.tipo || ""}
                  onChange={(e) =>
                    handleChange("blindagem", {
                      ...form.blindagem,
                      tipo: e.target.value,
                    })
                  }
                  className={styles.formInput}
                  placeholder="Ex: Nível III-A"
                />
              </div>
            )}
          </div>
        </div>

        {/* Opcionais */}
        <div className={styles.card} style={{ marginBottom: 24 }}>
          <h3
            style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}
          >
            Opcionais
          </h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              type="text"
              id="novo-opcional"
              className={styles.formInput}
              placeholder="Ex: Teto Solar Panorâmico"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const val = e.target.value.trim();
                  if (val) {
                    handleChange("opcionais", [...(form.opcionais || []), val]);
                    e.target.value = "";
                  }
                }
              }}
            />
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                const input = document.getElementById("novo-opcional");
                const val = input?.value.trim();
                if (val) {
                  handleChange("opcionais", [...(form.opcionais || []), val]);
                  input.value = "";
                }
              }}
            >
              +
            </button>
          </div>
          {form.opcionais?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {form.opcionais.map((opt, idx) => (
                <span
                  key={idx}
                  style={{
                    background: "#f0f0f0",
                    borderRadius: 20,
                    padding: "4px 12px",
                    fontSize: "0.85rem",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {opt}
                  <button
                    type="button"
                    onClick={() =>
                      handleChange(
                        "opcionais",
                        form.opcionais.filter((_, i) => i !== idx)
                      )
                    }
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      fontSize: "1rem",
                      lineHeight: 1,
                      color: "#999",
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Specs */}
        <div className={styles.card} style={{ marginBottom: 24 }}>
          <h3
            style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}
          >
            Ficha Técnica
          </h3>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Motor</label>
              <input
                type="text"
                value={form.specs.engine}
                onChange={(e) => handleSpecChange("engine", e.target.value)}
                className={styles.formInput}
                placeholder="Ex: 3.0 Biturbo Boxer"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Aceleração (0-100)</label>
              <input
                type="text"
                value={form.specs.acceleration}
                onChange={(e) =>
                  handleSpecChange("acceleration", e.target.value)
                }
                className={styles.formInput}
                placeholder="Ex: 3.4s (0-100km/h)"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Velocidade Máxima</label>
              <input
                type="text"
                value={form.specs.topSpeed}
                onChange={(e) => handleSpecChange("topSpeed", e.target.value)}
                className={styles.formInput}
                placeholder="Ex: 312 km/h"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Portas</label>
              <input
                type="number"
                value={form.specs.doors}
                onChange={(e) => handleSpecChange("doors", e.target.value)}
                className={styles.formInput}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Lugares</label>
              <input
                type="number"
                value={form.specs.seats}
                onChange={(e) => handleSpecChange("seats", e.target.value)}
                className={styles.formInput}
              />
            </div>
          </div>
        </div>

        <div className={styles.formActions}>
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={saving}
          >
            {saving
              ? "Salvando..."
              : editId
                ? "Atualizar Veículo"
                : "Cadastrar Veículo"}
          </button>
          <Link href="/admin/estoque" className={styles.btnSecondary}>
            Cancelar
          </Link>
        </div>
      </form>
    </>
  );
}

function FipePriceLookup({ brand, onApplyPrice }) {
  const [open, setOpen] = useState(false);
  const [marcas, setMarcas] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [anos, setAnos] = useState([]);
  const [marcaSel, setMarcaSel] = useState("");
  const [modeloSel, setModeloSel] = useState("");
  const [anoSel, setAnoSel] = useState("");
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/fipe?tipo=carros")
      .then((r) => r.json())
      .then((data) => {
        setMarcas(Array.isArray(data) ? data : []);
        if (brand) {
          const match = data.find(
            (m) => m.nome.toLowerCase() === brand.toLowerCase()
          );
          if (match) setMarcaSel(String(match.codigo));
        }
      })
      .catch(() => {});
  }, [open, brand]);

  useEffect(() => {
    if (!marcaSel) { setModelos([]); setModeloSel(""); return; }
    setModelos([]); setModeloSel(""); setAnos([]); setAnoSel(""); setResultado(null);
    fetch(`/api/admin/fipe?tipo=carros&marca=${marcaSel}`)
      .then((r) => r.json())
      .then((d) => setModelos(d.modelos || []))
      .catch(() => {});
  }, [marcaSel]);

  useEffect(() => {
    if (!modeloSel) { setAnos([]); setAnoSel(""); return; }
    setAnos([]); setAnoSel(""); setResultado(null);
    fetch(`/api/admin/fipe?tipo=carros&marca=${marcaSel}&modelo=${modeloSel}`)
      .then((r) => r.json())
      .then((d) => setAnos(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [modeloSel, marcaSel]);

  useEffect(() => {
    if (!anoSel) { setResultado(null); return; }
    setLoading(true); setResultado(null);
    fetch(`/api/admin/fipe?tipo=carros&marca=${marcaSel}&modelo=${modeloSel}&ano=${anoSel}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setResultado)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [anoSel, marcaSel, modeloSel]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ fontSize: "0.8rem", color: "#ff6a00", background: "none", border: "none", cursor: "pointer", padding: "4px 0", textDecoration: "underline" }}
      >
        Consultar preço FIPE
      </button>
    );
  }

  function applyPrice() {
    if (!resultado) return;
    const raw = resultado.Valor.replace(/[^\d]/g, "");
    const num = parseInt(raw, 10) / 100;
    onApplyPrice(String(num));
    setOpen(false);
  }

  return (
    <div style={{ marginTop: 8, padding: 12, background: "#f8f9fa", borderRadius: 8, border: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#555" }}>Consulta FIPE</span>
        <button type="button" onClick={() => setOpen(false)} style={{ fontSize: "0.75rem", color: "#888", background: "none", border: "none", cursor: "pointer" }}>Fechar</button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select
          value={marcaSel}
          onChange={(e) => setMarcaSel(e.target.value)}
          style={{ flex: 1, minWidth: 120, padding: "6px 8px", fontSize: "0.8rem", borderRadius: 6, border: "1px solid #d0d0d0" }}
        >
          <option value="">Marca</option>
          {marcas.map((m) => (
            <option key={m.codigo} value={m.codigo}>{m.nome}</option>
          ))}
        </select>
        <select
          value={modeloSel}
          onChange={(e) => setModeloSel(e.target.value)}
          disabled={!modelos.length}
          style={{ flex: 2, minWidth: 140, padding: "6px 8px", fontSize: "0.8rem", borderRadius: 6, border: "1px solid #d0d0d0" }}
        >
          <option value="">Modelo</option>
          {modelos.map((m) => (
            <option key={m.codigo} value={m.codigo}>{m.nome}</option>
          ))}
        </select>
        <select
          value={anoSel}
          onChange={(e) => setAnoSel(e.target.value)}
          disabled={!anos.length}
          style={{ flex: 1, minWidth: 120, padding: "6px 8px", fontSize: "0.8rem", borderRadius: 6, border: "1px solid #d0d0d0" }}
        >
          <option value="">Ano</option>
          {anos.map((a) => (
            <option key={a.codigo} value={a.codigo}>{a.nome}</option>
          ))}
        </select>
      </div>
      {loading && <p style={{ fontSize: "0.8rem", color: "#888", marginTop: 8 }}>Consultando...</p>}
      {resultado && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "1rem", fontWeight: 700, color: "#ff6a00" }}>{resultado.Valor}</span>
          <span style={{ fontSize: "0.75rem", color: "#888" }}>{resultado.MesReferencia}</span>
          <button
            type="button"
            onClick={applyPrice}
            style={{ marginLeft: "auto", padding: "4px 12px", fontSize: "0.8rem", background: "#ff6a00", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
          >
            Usar este preço
          </button>
        </div>
      )}
    </div>
  );
}
