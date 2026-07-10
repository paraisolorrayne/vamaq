"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import styles from "../admin.module.css";
import {
  renderCreative,
  exportName,
  loadSvgLogo,
  FORMATS,
  TEMPLATE_HINTS,
} from "@/lib/creativeRenderer";

const INITIAL_VALUES = {
  marca: "",
  modelo: "",
  ano: "",
  km: "",
  preco: "",
  badges: "",
  potencia: "",
  cambio: "",
  combustivel: "",
  aceleracao: "",
  handle: "@vamaqmotors",
  site: "vamaqmotors.com.br",
  ctaText: "",
  at1: "NOSSO",
  at2: "ACERVO",
  asub: "Curadoria rigorosa · Procedência garantida",
};

const EMPTY_AC = { nome: "", ano: "", km: "", preco: "" };
const EMPTY_AC_OPT = { zoom: 1, x: 0.5 };

// 299000 -> "299.000" (como o preço aparece no criativo)
function formatPrecoCreativo(price) {
  if (price === null || price === undefined || price === "") return "";
  const n = Number(price);
  if (!isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function loadImageFromUrl(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function loadImageFromFile(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

function Slider({ label, min, max, value, onChange }) {
  return (
    <div>
      <label className={styles.formLabel}>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#FF6A00" }}
      />
    </div>
  );
}

// Colunas minmax(0,1fr) + width 100% nos controles: sem isso a largura
// intrínseca dos inputs estoura os grids e os campos vazam do card.
const grid2 = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
  gap: "0 12px",
};
const grid3 = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)",
  gap: "0 12px",
};

function Field({ label, value, onChange, placeholder }) {
  return (
    <div className={styles.formGroup} style={{ minWidth: 0 }}>
      <label className={styles.formLabel}>{label}</label>
      <input
        type="text"
        className={styles.formInput}
        style={{ width: "100%", minWidth: 0 }}
        value={value}
        placeholder={placeholder || label}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function VehicleSelect({ vehicles, onPick, placeholder }) {
  if (!vehicles.length) return null;
  return (
    <select
      className={styles.formSelect}
      style={{ width: "100%", minWidth: 0 }}
      defaultValue=""
      onChange={(e) => {
        onPick(e.target.value);
      }}
    >
      <option value="">{placeholder}</option>
      {vehicles.map((v) => (
        <option key={v.id} value={v.id}>
          {v.brand} {v.model} {v.year} — {v.color}
        </option>
      ))}
    </select>
  );
}

export default function CriativosPage() {
  const canvasRef = useRef(null);
  const [fmt, setFmt] = useState("story");
  const [tpl, setTpl] = useState("vitrine");
  const [values, setValues] = useState(INITIAL_VALUES);
  const [f1, setF1] = useState({ zoom: 1, x: 0.5, y: 0.5 });
  const [foto1, setFoto1] = useState(null);
  const [customLogo, setCustomLogo] = useState(null);
  const [brandLogos, setBrandLogos] = useState({ light: null, dark: null });
  const [acervo, setAcervo] = useState([
    { ...EMPTY_AC },
    { ...EMPTY_AC },
    { ...EMPTY_AC },
    { ...EMPTY_AC },
  ]);
  const [acOpts, setAcOpts] = useState([
    { ...EMPTY_AC_OPT },
    { ...EMPTY_AC_OPT },
    { ...EMPTY_AC_OPT },
    { ...EMPTY_AC_OPT },
  ]);
  const [acImgs, setAcImgs] = useState([null, null, null, null]);
  const [vehicles, setVehicles] = useState([]);
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    fetch("/api/admin/vehicles")
      .then((r) => r.json())
      .then((list) => setVehicles(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, []);

  // Logos oficiais (as mesmas do site, em /public/images)
  useEffect(() => {
    let alive = true;
    Promise.all([
      loadSvgLogo("/images/vamaq-logo-on-light.svg"),
      loadSvgLogo("/images/vamaq-logo-on-dark.svg"),
    ]).then(([light, dark]) => {
      if (alive) setBrandLogos({ light, dark });
    });
    return () => {
      alive = false;
    };
  }, []);

  // Fontes do criativo (Rajdhani/Inter) precisam estar carregadas antes de
  // desenhar no canvas.
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Rajdhani:wght@500;600;700&display=swap";
    document.head.appendChild(link);
    const loads = [
      "700 96px Rajdhani",
      "600 48px Rajdhani",
      "500 32px Rajdhani",
      "400 30px Inter",
      "500 30px Inter",
      "600 26px Inter",
      "700 28px Inter",
    ].map((f) => document.fonts.load(f).catch(() => {}));
    Promise.all(loads).then(() => setFontsReady(true));
    document.fonts.ready.then(() => setFontsReady(true));
    return () => link.remove();
  }, []);

  const data = {
    fmt,
    tpl,
    values,
    acervo,
    images: {
      foto1,
      logo: customLogo,
      logoLight: brandLogos.light,
      logoDark: brandLogos.dark,
      ac: acImgs,
    },
    f1,
    acOpts,
  };

  useEffect(() => {
    if (canvasRef.current) renderCreative(canvasRef.current, data);
  });

  const setValue = useCallback((key, v) => {
    setValues((prev) => ({ ...prev, [key]: v }));
  }, []);

  async function fillFromVehicle(id) {
    const v = vehicles.find((veh) => veh.id === id);
    if (!v) return;
    setValues((prev) => ({
      ...prev,
      marca: v.brand || "",
      modelo: v.model || "",
      ano: v.year ? String(v.year) : "",
      km: v.quilometragem ? v.quilometragem.toLocaleString("pt-BR") : "",
      preco: formatPrecoCreativo(v.price),
      potencia: v.power || "",
      cambio: v.transmission || "",
      combustivel: v.fuel || "",
      aceleracao: v.specs?.acceleration || "",
      badges: [v.blindagem?.blindado ? "BLINDADO" : "", v.badge || ""]
        .filter(Boolean)
        .join(", "),
    }));
    if (v.images?.main) {
      const img = await loadImageFromUrl(v.images.main);
      if (img) {
        setFoto1(img);
        setF1({ zoom: 1, x: 0.5, y: 0.5 });
      }
    }
  }

  async function fillAcervoFromVehicle(i, id) {
    const v = vehicles.find((veh) => veh.id === id);
    if (!v) return;
    setAcervo((prev) =>
      prev.map((item, idx) =>
        idx === i
          ? {
              nome: [v.brand, v.model].filter(Boolean).join(" "),
              ano: v.year ? String(v.year) : "",
              km: v.quilometragem ? v.quilometragem.toLocaleString("pt-BR") : "",
              preco: formatPrecoCreativo(v.price),
            }
          : item
      )
    );
    if (v.images?.main) {
      const img = await loadImageFromUrl(v.images.main);
      if (img) {
        setAcImgs((prev) => prev.map((x, idx) => (idx === i ? img : x)));
        setAcOpts((prev) =>
          prev.map((x, idx) => (idx === i ? { ...EMPTY_AC_OPT } : x))
        );
      }
    }
  }

  function setAcervoField(i, key, v) {
    setAcervo((prev) =>
      prev.map((item, idx) => (idx === i ? { ...item, [key]: v } : item))
    );
  }

  function setAcOpt(i, key, v) {
    setAcOpts((prev) =>
      prev.map((item, idx) => (idx === i ? { ...item, [key]: v } : item))
    );
  }

  function download() {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = exportName(data);
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  }

  const seg = (options, current, onPick, orange) => (
    <div
      style={{
        display: "flex",
        background: "#f4f4f5",
        border: "1px solid #e5e5e5",
        borderRadius: 100,
        padding: 4,
        gap: 4,
      }}
    >
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onPick(v)}
          style={{
            flex: 1,
            border: 0,
            borderRadius: 100,
            padding: "9px 6px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            background:
              current === v ? (orange ? "#FF6A00" : "#0A0A0A") : "transparent",
            color: current === v ? "#fff" : "#555",
            transition: "0.2s",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const showVeiculo = tpl !== "acervo";

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Gerar Criativos</h1>
        <p className={styles.pageSubtitle}>
          Stories e Feed do Instagram — sem Photoshop, sem recortar fundo
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(340px, 400px) 1fr",
          gap: 28,
          alignItems: "start",
        }}
      >
        {/* ---------------- painel esquerdo ---------------- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className={styles.card}>
            <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: 12 }}>
              Formato
            </h3>
            {seg(
              [
                ["story", "Story · 1080×1920"],
                ["feed", "Feed · 1080×1350"],
              ],
              fmt,
              setFmt
            )}
            <h3
              style={{
                fontSize: "0.9rem",
                fontWeight: 700,
                margin: "16px 0 12px",
              }}
            >
              Template
            </h3>
            {seg(
              [
                ["vitrine", "Vitrine"],
                ["performance", "Performance"],
                ["acervo", "Acervo"],
              ],
              tpl,
              setTpl,
              true
            )}
            <p style={{ fontSize: "0.75rem", color: "#999", marginTop: 10, lineHeight: 1.5 }}>
              {TEMPLATE_HINTS[tpl]}
            </p>
          </div>

          {showVeiculo && (
            <div className={styles.card}>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: 12 }}>
                Veículo
              </h3>
              {vehicles.length > 0 && (
                <div className={styles.formGroup} style={{ marginBottom: 12 }}>
                  <label className={styles.formLabel}>
                    Preencher do estoque (foto + dados)
                  </label>
                  <VehicleSelect
                    vehicles={vehicles}
                    onPick={fillFromVehicle}
                    placeholder="Selecione um veículo..."
                  />
                </div>
              )}
              <div style={grid2}>
                <Field label="Marca" value={values.marca} onChange={(v) => setValue("marca", v)} />
                <Field label="Ano" value={values.ano} onChange={(v) => setValue("ano", v)} />
              </div>
              <Field label="Modelo" value={values.modelo} onChange={(v) => setValue("modelo", v)} />
              <div style={grid2}>
                <Field label="KM" value={values.km} onChange={(v) => setValue("km", v)} />
                <Field
                  label="Preço (vazio = Consulte)"
                  value={values.preco}
                  onChange={(v) => setValue("preco", v)}
                />
              </div>
              <Field
                label="Diferenciais (até 3, separados por vírgula)"
                value={values.badges}
                onChange={(v) => setValue("badges", v)}
                placeholder="BLINDADO, TETO SOLAR, ÚNICO DONO"
              />
              {tpl === "vitrine" ? (
                <div style={grid3}>
                  <Field
                    label="Potência"
                    value={values.potencia}
                    onChange={(v) => setValue("potencia", v)}
                  />
                  <Field label="Câmbio" value={values.cambio} onChange={(v) => setValue("cambio", v)} />
                  <Field
                    label="Combustível"
                    value={values.combustivel}
                    onChange={(v) => setValue("combustivel", v)}
                  />
                </div>
              ) : (
                <div style={grid2}>
                  <Field
                    label="Potência"
                    value={values.potencia}
                    onChange={(v) => setValue("potencia", v)}
                  />
                  <Field
                    label="0–100 km/h"
                    value={values.aceleracao}
                    onChange={(v) => setValue("aceleracao", v)}
                    placeholder="3.4s"
                  />
                </div>
              )}
            </div>
          )}

          {showVeiculo && (
            <div className={styles.card}>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: 12 }}>
                Foto principal
              </h3>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const img = await loadImageFromFile(file);
                  if (img) {
                    setFoto1(img);
                    setF1({ zoom: 1, x: 0.5, y: 0.5 });
                  }
                }}
              />
              <div style={{ ...grid3, marginTop: 10 }}>
                <Slider
                  label="Zoom"
                  min={55}
                  max={220}
                  value={Math.round(f1.zoom * 100)}
                  onChange={(v) => setF1((p) => ({ ...p, zoom: v / 100 }))}
                />
                <Slider
                  label="Posição ↔"
                  min={0}
                  max={100}
                  value={Math.round(f1.x * 100)}
                  onChange={(v) => setF1((p) => ({ ...p, x: v / 100 }))}
                />
                <Slider
                  label="Posição ↕"
                  min={0}
                  max={100}
                  value={Math.round(f1.y * 100)}
                  onChange={(v) => setF1((p) => ({ ...p, y: v / 100 }))}
                />
              </div>
              <p style={{ fontSize: "0.75rem", color: "#999", marginTop: 8, lineHeight: 1.5 }}>
                A foto nunca precisa de recorte: o carro aparece inteiro e as
                sobras são preenchidas automaticamente.
              </p>
            </div>
          )}

          {tpl === "acervo" && (
            <div className={styles.card}>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: 12 }}>
                Acervo — título e carros
              </h3>
              <div style={grid2}>
                <Field label="Título — linha 1" value={values.at1} onChange={(v) => setValue("at1", v)} />
                <Field label="Título — linha 2" value={values.at2} onChange={(v) => setValue("at2", v)} />
              </div>
              <Field label="Subtítulo" value={values.asub} onChange={(v) => setValue("asub", v)} />
              {acervo.map((item, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid #e5e5e5",
                    borderRadius: 10,
                    padding: 12,
                    marginTop: 12,
                    background: "#fafafa",
                  }}
                >
                  <b style={{ fontSize: "0.75rem", letterSpacing: "0.08em", color: "#FF6A00" }}>
                    CARRO {i + 1}
                  </b>
                  {vehicles.length > 0 && (
                    <div className={styles.formGroup} style={{ marginTop: 8 }}>
                      <VehicleSelect
                        vehicles={vehicles}
                        onPick={(id) => fillAcervoFromVehicle(i, id)}
                        placeholder="Preencher do estoque..."
                      />
                    </div>
                  )}
                  <Field
                    label="Nome"
                    value={item.nome}
                    onChange={(v) => setAcervoField(i, "nome", v)}
                    placeholder="ex.: BMW 320i M Sport"
                  />
                  <div style={grid3}>
                    <Field label="Ano" value={item.ano} onChange={(v) => setAcervoField(i, "ano", v)} />
                    <Field label="KM" value={item.km} onChange={(v) => setAcervoField(i, "km", v)} />
                    <Field
                      label="Preço"
                      value={item.preco}
                      onChange={(v) => setAcervoField(i, "preco", v)}
                      placeholder="vazio = Consulte"
                    />
                  </div>
                  <label className={styles.formLabel} style={{ marginTop: 8 }}>
                    Foto
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const img = await loadImageFromFile(file);
                      if (img)
                        setAcImgs((prev) => prev.map((x, idx) => (idx === i ? img : x)));
                    }}
                  />
                  <div style={{ ...grid2, marginTop: 8 }}>
                    <Slider
                      label="Zoom"
                      min={55}
                      max={200}
                      value={Math.round(acOpts[i].zoom * 100)}
                      onChange={(v) => setAcOpt(i, "zoom", v / 100)}
                    />
                    <Slider
                      label="Posição ↔"
                      min={0}
                      max={100}
                      value={Math.round(acOpts[i].x * 100)}
                      onChange={(v) => setAcOpt(i, "x", v / 100)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={styles.card}>
            <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: 12 }}>
              Rodapé e logo
            </h3>
            <div style={grid2}>
              <Field label="Instagram" value={values.handle} onChange={(v) => setValue("handle", v)} />
              <Field label="Site" value={values.site} onChange={(v) => setValue("site", v)} />
            </div>
            <Field
              label="Texto do botão (opcional)"
              value={values.ctaText}
              onChange={(v) => setValue("ctaText", v)}
              placeholder="ex.: AGENDE SUA VISITA"
            />
            <label className={styles.formLabel} style={{ marginTop: 8 }}>
              Logo personalizada (opcional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const img = await loadImageFromFile(file);
                if (img) setCustomLogo(img);
              }}
            />
          </div>

          <div className={styles.card}>
            <button className={styles.btnPrimary} style={{ width: "100%" }} onClick={download}>
              Baixar PNG
            </button>
            <p style={{ fontSize: "0.75rem", color: "#999", textAlign: "center", marginTop: 8 }}>
              {exportName(data)}
            </p>
          </div>
        </div>

        {/* ---------------- preview ---------------- */}
        <div
          style={{
            position: "sticky",
            top: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            className={styles.card}
            style={{ padding: 16, boxShadow: "0 12px 40px rgba(0,0,0,.08)" }}
          >
            <canvas
              ref={canvasRef}
              width={1080}
              height={1920}
              style={{
                display: "block",
                maxHeight: "78vh",
                maxWidth: "100%",
                width: "auto",
                height: "auto",
                borderRadius: 8,
                opacity: fontsReady ? 1 : 0.4,
              }}
            />
          </div>
          <span
            style={{
              fontSize: "0.75rem",
              color: "#999",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {FORMATS[fmt].label}
          </span>
        </div>
      </div>
    </>
  );
}
