"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../../../admin.module.css";
import crm from "../../crm.module.css";

export default function PerderForm({ oportunidadeId }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      const res = await fetch(`/api/admin/crm/oportunidades/${oportunidadeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etapa: "perdido", motivo_perda: motivo.trim() || null }),
      });
      if (!res.ok) throw new Error("Falha ao salvar");
      router.push(`/admin/crm/${oportunidadeId}`);
    } catch {
      setErro("Não foi possível salvar agora. Verifique a conexão e tente de novo.");
    } finally {
      // Ver AcoesCard.js: mesmo com router.push (não router.refresh), o
      // reset fica no `finally` por hábito — é o defeito que já aconteceu
      // nesta branch e não pode se repetir aqui.
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {erro && <p className={crm.erroForm}>{erro}</p>}

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Motivo da perda (opcional)</label>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className={`${styles.formTextarea} ${crm.campoToque}`}
          rows={5}
          placeholder="Ex: fechou com outro vendedor, preço, financiamento não aprovado..."
        />
      </div>

      <div className={crm.formActions}>
        <button type="submit" className={crm.btnPerder} disabled={salvando}>
          {salvando ? "Salvando..." : "Marcar como perdido"}
        </button>
        <Link href={`/admin/crm/${oportunidadeId}`} className={crm.btnSecundario}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
