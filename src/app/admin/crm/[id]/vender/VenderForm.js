"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import crm from "../../crm.module.css";

export default function VenderForm({ oportunidadeId }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function confirmar() {
    setErro("");
    setSalvando(true);
    try {
      const res = await fetch(`/api/admin/crm/oportunidades/${oportunidadeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "registrar-venda" }),
      });
      if (!res.ok) throw new Error("Falha ao registrar a venda");
      router.push(`/admin/crm/${oportunidadeId}`);
    } catch {
      setErro("Não foi possível registrar a venda agora. Verifique a conexão e tente de novo.");
    } finally {
      // Ver AcoesCard.js: reset no `finally`, não só no `catch` — no
      // sucesso o router.push troca de rota (este componente some), mas o
      // hábito é o mesmo em toda tela desta entrega que tem estado de
      // carregamento.
      setSalvando(false);
    }
  }

  return (
    <div className={crm.formActions}>
      {erro && <p className={crm.acoesErro}>{erro}</p>}
      <button type="button" className={crm.btnPrimario} disabled={salvando} onClick={confirmar}>
        {salvando ? "Confirmando..." : "Confirmar a venda"}
      </button>
      <Link href={`/admin/crm/${oportunidadeId}`} className={crm.btnSecundario}>
        Cancelar
      </Link>
    </div>
  );
}
