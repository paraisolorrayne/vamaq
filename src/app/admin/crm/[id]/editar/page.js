import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { getOportunidade } from "@/lib/crm/oportunidades";
import { formatValorBR } from "@/lib/money";
import FormOportunidade from "../../FormOportunidade";
import styles from "../../../admin.module.css";
import crm from "../../crm.module.css";

export const metadata = {
  title: "Editar oportunidade — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function EditarOportunidadePage({ params }) {
  // O layout do /admin já barra por papel; aqui é defesa em profundidade,
  // igual à lista (src/app/admin/crm/page.js).
  await requireRole(["vendedor", "secretaria"]);
  const { id } = await params;
  const o = await getOportunidade(id);
  if (!o) notFound();

  // O valor vai formatado em pt-BR (é o que a pessoa espera ver) — o
  // FormOportunidade não reformata, e o servidor entende esse formato de
  // volta via valorDaOportunidade (Task 2).
  const valoresIniciais = {
    cliente_nome: o.cliente_nome,
    cliente_id: o.cliente_id,
    telefone: o.telefone,
    email: o.email,
    vehicle_id: o.vehicle_id,
    valor: o.valor != null ? formatValorBR(o.valor) : "",
    origem: o.origem,
    obs: o.obs,
  };

  return (
    <>
      <Link href={`/admin/crm/${id}`} className={crm.voltar}>
        ← Voltar
      </Link>

      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Editar oportunidade</h1>
        <p className={styles.pageSubtitle}>{o.cliente_nome}</p>
      </div>

      <FormOportunidade valoresIniciais={valoresIniciais} oportunidadeId={id} />
    </>
  );
}
