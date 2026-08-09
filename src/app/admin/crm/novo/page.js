import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";
import FormOportunidade from "../FormOportunidade";
import styles from "../../admin.module.css";
import crm from "../crm.module.css";

export const metadata = {
  title: "Nova oportunidade — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function NovaOportunidadePage() {
  // O layout do /admin já barra por papel; aqui é defesa em profundidade,
  // igual à lista (src/app/admin/crm/page.js).
  await requireRole(["vendedor", "secretaria"]);

  return (
    <>
      <Link href="/admin/crm" className={crm.voltar}>
        ← Voltar
      </Link>

      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Nova oportunidade</h1>
        <p className={styles.pageSubtitle}>Cadastre um novo lead no funil de vendas</p>
      </div>

      <FormOportunidade valoresIniciais={null} oportunidadeId={null} />
    </>
  );
}
