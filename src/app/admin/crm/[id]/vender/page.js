import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { getOportunidade } from "@/lib/crm/oportunidades";
import { rotuloVeiculo } from "@/lib/crm/rotuloVeiculo";
import styles from "../../../admin.module.css";
import crm from "../../crm.module.css";
import VenderForm from "./VenderForm";

export const metadata = {
  title: "Registrar a venda — Vamaq Motors",
  robots: { index: false, follow: false },
};

// Veículo por extenso para esta tela: marca, modelo, ano (via rotuloVeiculo,
// já usado na lista e no card) e a placa, que só importa aqui — é por isso
// que não entrou em rotuloVeiculo, que é usado também na mensagem de
// WhatsApp e não deveria carregar a placa lá.
function veiculoComPlaca(o) {
  const base = rotuloVeiculo(o);
  if (!base) return "";
  return o.vehicle_placa ? `${base} — placa ${o.vehicle_placa}` : base;
}

export default async function VenderPage({ params }) {
  // O layout do /admin já barra por papel; aqui é defesa em profundidade,
  // igual à lista (src/app/admin/crm/page.js).
  await requireRole(["vendedor", "secretaria"]);
  const { id } = await params;
  const o = await getOportunidade(id);
  if (!o) notFound();

  const veiculo = veiculoComPlaca(o);

  return (
    <>
      <Link href={`/admin/crm/${id}`} className={crm.voltar}>
        ← Voltar
      </Link>

      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Registrar a venda</h1>
        <p className={styles.pageSubtitle}>{o.cliente_nome}</p>
      </div>

      {!o.vehicle_id ? (
        <>
          <p className={crm.info}>
            Esta oportunidade não tem um veículo vinculado, e a venda precisa de um veículo
            para marcar como vendido. Vincule um veículo na edição antes de registrar a
            venda.
          </p>
          <Link href={`/admin/crm/${id}/editar`} className={crm.btnSecundario}>
            Editar oportunidade
          </Link>
        </>
      ) : (
        <>
          <div className={crm.dados}>
            <div className={crm.dadoRow}>
              <span className={crm.dadoLabel}>Cliente</span>
              <span className={crm.dadoValue}>{o.cliente_nome}</span>
            </div>
            <div className={crm.dadoRow}>
              <span className={crm.dadoLabel}>Veículo</span>
              <span className={crm.dadoValue}>{veiculo || "—"}</span>
            </div>
          </div>

          <ul className={crm.avisos}>
            <li className={crm.avisoItem}>O veículo é marcado como <strong>VENDIDO</strong>.</li>
            <li className={crm.avisoItem}>Ele sai do site na hora.</li>
            <li className={crm.avisoItem}>
              A receita <strong>não</strong> é lançada sozinha: registre-a no Financeiro,
              ligada a este veículo — sem isso a margem não sai.
            </li>
          </ul>

          <VenderForm oportunidadeId={id} />
        </>
      )}
    </>
  );
}
