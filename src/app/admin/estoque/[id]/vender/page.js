import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { canAccessPath } from "@/lib/auth/permissions";
import { getVehicleById } from "@/lib/vehicleStore";
import { anoVeiculo } from "@/lib/anoVeiculo";
import { podeMarcarVendido } from "@/lib/vendaVeiculo";
import styles from "../../../admin.module.css";
// Reaproveita o CSS da tela irmã do CRM (src/app/admin/crm/[id]/vender/) —
// mesmo layout, mesmos avisos, mesma folha: .telaAcao, .dados, .avisos e os
// botões já têm os 48px de alvo garantidos ali (ver o comentário de
// .voltar em crm.module.css). admin.module.css não ganha classe nova.
import crm from "../../../crm/crm.module.css";
import VenderForm from "./VenderForm";

export const metadata = {
  title: "Marcar vendido — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function VenderVeiculoPage({ params }) {
  // O layout do /admin já barra por prefixo; esta guarda é defesa em
  // profundidade — mesmos quatro papéis que já veem o Estoque (ver
  // src/app/admin/estoque/page.js), nenhum acesso a mais.
  const user = await requireRole(["estoque", "financeiro", "vendedor", "secretaria"]);
  const { id } = await params;
  const veiculo = await getVehicleById(id);
  if (!veiculo) notFound();

  // Fonte única da regra "quando dá para marcar vendido" — a mesma que
  // decide se o botão aparece na lista do Estoque (EstoqueClient.js). Esta
  // tela é alcançável fora dali (histórico do navegador, link salvo), então
  // tem que reconferir aqui: sem isso, um veículo já vendido (ou inativo)
  // conseguiria ser marcado de novo.
  const podeVender = podeMarcarVendido(veiculo);
  const nomeVeiculo = [veiculo.brand, veiculo.model, anoVeiculo(veiculo)]
    .filter(Boolean)
    .join(" ");
  const podeEmitirNota = canAccessPath(user.role, "/admin/fiscal");

  return (
    <>
      <Link href="/admin/estoque" className={crm.voltar}>
        ← Voltar
      </Link>

      <div className={crm.telaAcao}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Marcar vendido</h1>
          <p className={styles.pageSubtitle}>{nomeVeiculo || "Veículo"}</p>
        </div>

        {!podeVender ? (
          <>
            <p className={crm.info}>
              {veiculo.status === "vendido"
                ? "Este veículo já foi marcado como vendido — marcar de novo duplicaria o vínculo com o cliente."
                : "Este veículo está inativo e não pode ser marcado como vendido agora. Reative-o no Estoque antes de vender."}
            </p>
            {veiculo.status === "vendido" && podeEmitirNota ? (
              <Link
                href={`/admin/fiscal/emitir/${veiculo.id}`}
                className={crm.btnSecundario}
              >
                Emitir nota
              </Link>
            ) : (
              <Link href="/admin/estoque" className={crm.btnSecundario}>
                Voltar ao Estoque
              </Link>
            )}
          </>
        ) : (
          <>
            <div className={crm.dados}>
              <div className={crm.dadoRow}>
                <span className={crm.dadoLabel}>Veículo</span>
                <span className={crm.dadoValue}>{nomeVeiculo || "—"}</span>
              </div>
              <div className={crm.dadoRow}>
                <span className={crm.dadoLabel}>Placa</span>
                <span className={crm.dadoValue}>{veiculo.placa || "—"}</span>
              </div>
            </div>

            <VenderForm veiculoId={veiculo.id} />
          </>
        )}
      </div>
    </>
  );
}
