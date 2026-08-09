import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";
import { listOportunidades } from "@/lib/crm/oportunidades";
import { ETAPAS_INFO, rotuloEtapa } from "@/lib/crm/etapas";
import { anoVeiculo } from "@/lib/anoVeiculo";
import { formatValorBR } from "@/lib/money";
import styles from "../admin.module.css";
import crm from "./crm.module.css";

export const metadata = {
  title: "CRM — Vamaq Motors",
  robots: { index: false, follow: false },
};

function veiculoLabel(o) {
  if (!o.vehicle_brand) return "sem veículo";
  const ano = anoVeiculo({ year: o.vehicle_year, ano_modelo: o.vehicle_ano_modelo });
  return [o.vehicle_brand, o.vehicle_model, ano].filter(Boolean).join(" ");
}

function valorLabel(o) {
  return o.valor != null ? `R$ ${formatValorBR(Number(o.valor))}` : null;
}

export default async function CrmPage() {
  // O layout do /admin já barra por papel; aqui é defesa em profundidade.
  await requireRole(["vendedor", "secretaria"]);
  const oportunidades = await listOportunidades();
  const emAberto = oportunidades.filter((o) => !["ganho", "perdido"].includes(o.etapa)).length;

  const grupos = ETAPAS_INFO.map((et) => ({
    etapa: et.key,
    label: rotuloEtapa(et.key),
    cards: oportunidades.filter((o) => o.etapa === et.key),
  })).filter((g) => g.cards.length > 0);

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>CRM — Funil de vendas</h1>
        <p className={styles.pageSubtitle}>{emAberto} oportunidade(s) em aberto</p>
      </div>

      <Link href="/admin/crm/novo" className={crm.novoBtn}>
        + Nova oportunidade
      </Link>

      {oportunidades.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>Nenhuma oportunidade ainda.</p>
        </div>
      ) : (
        grupos.map((g) => (
          <div key={g.etapa} className={crm.grupo}>
            <div className={crm.grupoHead}>
              {g.label.toUpperCase()} · {g.cards.length}
            </div>
            <div className={crm.grupoCards}>
              {g.cards.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/crm/${o.id}`}
                  className={`${crm.card} ${o.etapa === "ganho" ? crm.cardGanho : ""} ${o.etapa === "perdido" ? crm.cardPerdido : ""}`}
                >
                  <div className={crm.cardNome}>{o.cliente_nome}</div>
                  <div className={crm.cardMeta}>{veiculoLabel(o)}</div>
                  {valorLabel(o) && <div className={crm.cardValor}>{valorLabel(o)}</div>}
                  {o.origem && <div className={crm.cardMeta}>{o.origem}</div>}
                  {o.etapa === "perdido" && o.motivo_perda && (
                    <div className={crm.cardMeta}>Perda: {o.motivo_perda}</div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}
