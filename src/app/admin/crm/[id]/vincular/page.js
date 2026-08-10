import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { getOportunidade } from "@/lib/crm/oportunidades";
import styles from "../../../admin.module.css";
import crm from "../../crm.module.css";
import VincularForm from "./VincularForm";

export const metadata = {
  title: "Vincular a um cliente — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function VincularPage({ params }) {
  // O layout do /admin já barra por papel; aqui é defesa em profundidade,
  // igual à lista (src/app/admin/crm/page.js). O mesmo papel que registra a
  // oportunidade (vendedor/secretaria) já pode vincular — não é ação de
  // secretaria só.
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
          <h1 className={styles.pageTitle}>Vincular a um cliente</h1>
          <p className={styles.pageSubtitle}>{o.cliente_nome}</p>
        </div>

        <p className={crm.info}>
          Busque pelo nome, CPF/CNPJ ou telefone e escolha quem já está cadastrado — evita
          duplicar o cliente na base. Se não achar ninguém, você pode cadastrar.
        </p>

        <VincularForm oportunidade={o} />
      </div>
    </>
  );
}
