"use client";

import { useState } from "react";
import styles from "../admin.module.css";

/**
 * Envio das gravações que ilustram os tutoriais. Só admin enxerga.
 *
 * Existe para que regravar um passo — quando a tela muda — não dependa de
 * acesso ao servidor. O nome (slug) é o mesmo usado no componente
 * <Demonstracao> dentro do tutorial; enviar de novo com o mesmo nome
 * substitui a gravação antiga.
 */
export default function EnviarGravacao({ slugs }) {
  const [enviando, setEnviando] = useState(null);
  const [aviso, setAviso] = useState(null);

  async function enviar(slug, file) {
    if (!file) return;
    setEnviando(slug);
    setAviso(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/admin/tutoriais/video/${slug}`, { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      setAviso(
        r.ok
          ? { ok: true, texto: `Gravação de "${slug}" atualizada (${Math.round((d.tamanho || 0) / 1024)} KB).` }
          : { ok: false, texto: d.error || "Não foi possível enviar." }
      );
    } catch {
      setAviso({ ok: false, texto: "Falha de conexão." });
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div className={styles.card} style={{ marginTop: 32 }}>
      <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 4 }}>Gravações dos tutoriais</h3>
      <p style={{ fontSize: "0.85rem", color: "#666", marginTop: 0 }}>
        Só administradores veem esta parte. Enviar um arquivo com o mesmo nome substitui a
        gravação que está no ar.
      </p>

      {aviso && (
        <p style={{ fontSize: "0.85rem", color: aviso.ok ? "#15803d" : "#b91c1c" }}>{aviso.texto}</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {slugs.map((s) => (
          <div key={s.slug} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <label
              className={`${styles.btnSecondary} ${styles.btnSmall}`}
              style={{ cursor: "pointer", minHeight: 48, display: "inline-flex", alignItems: "center" }}
            >
              {enviando === s.slug ? "Enviando…" : "Enviar .gif"}
              <input
                type="file"
                accept=".gif,image/gif"
                onChange={(e) => { enviar(s.slug, e.target.files?.[0]); e.target.value = ""; }}
                disabled={enviando === s.slug}
                style={{ display: "none" }}
              />
            </label>
            <div style={{ minWidth: 0 }}>
              <strong style={{ fontSize: "0.9rem" }}>{s.titulo}</strong>
              <span style={{ display: "block", fontSize: "0.75rem", color: "#888" }}>{s.slug}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
