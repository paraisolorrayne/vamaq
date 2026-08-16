"use client";

import { useState } from "react";
import t from "./tutorial.module.css";

/**
 * Demonstração em vídeo de um passo do tutorial.
 *
 * Fica FECHADA por padrão e só busca o arquivo quando a pessoa abre. Uma
 * gravação passa de 1 MB, e a equipe abre o tutorial no celular, no meio do
 * expediente — carregar isso para quem só queria conferir um texto seria
 * gastar o pacote de dados dela à toa.
 */
export default function Demonstracao({ slug, titulo, legenda }) {
  const [aberta, setAberta] = useState(false);

  return (
    <div className={t.tip} style={{ padding: 0, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setAberta((a) => !a)}
        style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%",
          minHeight: 48, padding: "12px 16px", background: "none", border: "none",
          cursor: "pointer", font: "inherit", textAlign: "left",
        }}
        aria-expanded={aberta}
      >
        <span aria-hidden="true">{aberta ? "▾" : "▸"}</span>
        <strong>{aberta ? "Fechar demonstração" : `Ver demonstração: ${titulo}`}</strong>
      </button>

      {aberta && (
        <div style={{ padding: "0 16px 16px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/admin/tutoriais/video/${slug}`}
            alt={`Demonstração: ${titulo}`}
            style={{
              width: "100%", height: "auto", display: "block",
              border: "1px solid #e5e5e5", borderRadius: 6,
            }}
          />
          {legenda && (
            <p style={{ fontSize: "0.8rem", color: "#666", margin: "8px 0 0" }}>{legenda}</p>
          )}
        </div>
      )}
    </div>
  );
}
