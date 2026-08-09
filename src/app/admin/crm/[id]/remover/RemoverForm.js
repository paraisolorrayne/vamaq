"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../../../admin.module.css";
import crm from "../../crm.module.css";

export default function RemoverForm({ oportunidadeId }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  // Ver AcoesCard.js: `router.push()`, como `router.refresh()`, não
  // bloqueia — dispara a navegação e devolve na hora. Sem isto, o `finally`
  // reabilitava o botão antes de a tela sair de verdade: um segundo toque
  // nessa janela mandava um segundo DELETE (que só acha 404, já removido) e
  // acendia o erro vermelho numa tela que já estava de saída.
  const [isPending, startTransition] = useTransition();

  async function confirmar() {
    setErro("");
    setSalvando(true);
    try {
      const res = await fetch(`/api/admin/crm/oportunidades/${oportunidadeId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Falha ao remover");
      startTransition(() => {
        router.push("/admin/crm");
      });
    } catch {
      setErro("Não foi possível remover agora. Verifique a conexão e tente de novo.");
    } finally {
      // Ver AcoesCard.js: reset no `finally`, hábito desta entrega. O botão
      // continua protegido depois disso por `isPending` (abaixo).
      setSalvando(false);
    }
  }

  return (
    <div className={crm.formActions}>
      {erro && <p className={crm.acoesErro}>{erro}</p>}
      <button
        type="button"
        className={`${styles.btnDanger} ${crm.acaoToque}`}
        disabled={salvando || isPending}
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
