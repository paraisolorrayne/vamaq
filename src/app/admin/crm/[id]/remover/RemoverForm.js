"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../../../admin.module.css";
import crm from "../../crm.module.css";

export default function RemoverForm({ oportunidadeId }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function confirmar() {
    setErro("");
    setSalvando(true);
    try {
      const res = await fetch(`/api/admin/crm/oportunidades/${oportunidadeId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Falha ao remover");
      router.push("/admin/crm");
    } catch {
      setErro("Não foi possível remover agora. Verifique a conexão e tente de novo.");
    } finally {
      // Ver AcoesCard.js: reset no `finally`, hábito desta entrega.
      setSalvando(false);
    }
  }

  return (
    <div className={crm.formActions}>
      {erro && <p className={crm.acoesErro}>{erro}</p>}
      <button
        type="button"
        className={`${styles.btnDanger} ${crm.acaoToque}`}
        disabled={salvando}
        onClick={confirmar}
      >
        {salvando ? "Removendo..." : "Remover definitivamente"}
      </button>
      <Link href={`/admin/crm/${oportunidadeId}`} className={crm.btnSecundario}>
        Cancelar
      </Link>
    </div>
  );
}
