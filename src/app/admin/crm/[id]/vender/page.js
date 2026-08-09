import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { getOportunidade } from "@/lib/crm/oportunidades";
import { acoesDaEtapa, rotuloEtapa } from "@/lib/crm/etapas";
import { veiculoComPlaca } from "@/lib/crm/veiculoComPlaca";
import styles from "../../../admin.module.css";
import crm from "../../crm.module.css";
import VenderForm from "./VenderForm";

export const metadata = {
  title: "Registrar a venda — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function VenderPage({ params }) {
  // O layout do /admin já barra por papel; aqui é defesa em profundidade,
  // igual à lista (src/app/admin/crm/page.js).
  await requireRole(["vendedor", "secretaria"]);
  const { id } = await params;
  const o = await getOportunidade(id);
  if (!o) notFound();

  // Fonte única da regra "quando dá para vender" — a mesma que decide se o
  // AcoesCard oferece o botão (src/lib/crm/etapas.js). Esta tela é
  // alcançável fora dali (histórico do navegador, link salvo), então tem
  // que reconferir aqui: sem isso, uma oportunidade Perdida com veículo
  // ligado conseguia confirmar a venda e tirar o carro do site.
  const acoes = acoesDaEtapa(o);
  const veiculo = veiculoComPlaca(o);

  return (
    <>
      <Link href={`/admin/crm/${id}`} className={crm.voltar}>
        ← Voltar
      </Link>

      <div className={crm.telaAcao}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Registrar a venda</h1>
          <p className={styles.pageSubtitle}>{o.cliente_nome}</p>
        </div>

        {!acoes.podeVender ? (
          <>
            <p className={crm.info}>
              {!o.vehicle_id
                ? "Esta oportunidade não tem um veículo vinculado, e a venda precisa de um veículo para marcar como vendido. Vincule um veículo na edição antes de registrar a venda."
                : `Esta oportunidade está em "${rotuloEtapa(o.etapa)}", e só é possível registrar a venda quando ela está em "Ganho". Mova a oportunidade para Ganho antes de registrar a venda.`}
            </p>
            <Link
              href={!o.vehicle_id ? `/admin/crm/${id}/editar` : `/admin/crm/${id}/mover`}
              className={crm.btnSecundario}
            >
              {!o.vehicle_id ? "Editar oportunidade" : "Mover para outra etapa"}
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
      </div>
    </>
  );
}
