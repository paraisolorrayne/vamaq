import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { getOportunidade } from "@/lib/crm/oportunidades";
import styles from "../../../admin.module.css";
import crm from "../../crm.module.css";
import RemoverForm from "./RemoverForm";

export const metadata = {
  title: "Remover oportunidade — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function RemoverPage({ params }) {
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

      <div className={crm.telaAcao}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Remover a oportunidade</h1>
          <p className={styles.pageSubtitle}>{o.cliente_nome}</p>
        </div>

        <p className={crm.info}>
          Esta oportunidade some de vez da lista — não dá para desfazer. Remover não mexe no
          veículo nem em nada do financeiro.
        </p>
        <p className={crm.info}>
          Se você só quer tirar esta oportunidade do funil sem perder o histórico, marque
          como perdida em vez de remover.
        </p>
        <Link href={`/admin/crm/${id}/perder`} className={crm.btnSecundario}>
          Marcar como perdido
        </Link>

        <RemoverForm oportunidadeId={id} />
      </div>
    </>
  );
}
