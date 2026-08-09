"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ETAPAS_INFO } from "@/lib/crm/etapas";
import crm from "../../crm.module.css";

export default function MoverForm({ oportunidadeId, etapaAtual }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function escolher(etapa) {
    // O motivo faz parte de "perder" — esta tela não grava `perdido` direto,
    // manda para a tela que pede o motivo.
    if (etapa === "perdido") {
      router.push(`/admin/crm/${oportunidadeId}/perder`);
      return;
    }

    setErro("");
    setCarregando(true);
    try {
      const res = await fetch(`/api/admin/crm/oportunidades/${oportunidadeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etapa }),
      });
      if (!res.ok) throw new Error("Falha ao salvar");
      router.push(`/admin/crm/${oportunidadeId}`);
    } catch {
      setErro("Não foi possível salvar agora. Verifique a conexão e tente de novo.");
    } finally {
      // Ver AcoesCard.js: reset no `finally`, hábito desta entrega.
      setCarregando(false);
    }
  }

  return (
    <div className={crm.formActions}>
      {erro && <p className={crm.acoesErro}>{erro}</p>}

      {ETAPAS_INFO.map((etapa) => {
        const atual = etapa.key === etapaAtual;
        return (
          <button
            key={etapa.key}
            type="button"
            className={`${crm.btnSecundario} ${atual ? crm.etapaAtual : ""}`}
            disabled={atual || carregando}
            onClick={() => escolher(etapa.key)}
          >
            {etapa.label}
            {atual && <span className={crm.etapaMarca}>Atual</span>}
          </button>
        );
      })}
    </div>
  );
}
