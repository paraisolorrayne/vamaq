import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { getOportunidade } from "@/lib/crm/oportunidades";
import styles from "../../../admin.module.css";
import crm from "../../crm.module.css";
import PerderForm from "./PerderForm";

export const metadata = {
  title: "Marcar como perdido — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function PerderPage({ params }) {
  // O layout do /admin já barra por papel; aqui é defesa em profundidade,
  // igual à lista (src/app/admin/crm/page.js).
  await requireRole(["vendedor", "secretaria"]);
  const { id } = await params;
  const o = await getOportunidade(id);
  if (!o) notFound();

  return (
    <>
      <Link href={`/admin/crm/${id}`} className={crm.voltar}>
        ← Voltar
      </Link>

      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Marcar como perdido</h1>
        <p className={styles.pageSubtitle}>{o.cliente_nome}</p>
      </div>

      <p className={crm.info}>
        A oportunidade não é apagada: ela continua na lista, na etapa Perdido, e pode ser
        reaberta a qualquer momento.
      </p>

      <PerderForm oportunidadeId={id} />
    </>
  );
}
