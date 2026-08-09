import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { getOportunidade } from "@/lib/crm/oportunidades";
import { rotuloEtapa } from "@/lib/crm/etapas";
import { rotuloVeiculo } from "@/lib/crm/rotuloVeiculo";
import { formatValorBR } from "@/lib/money";
import AcoesCard from "./AcoesCard";
import crm from "../crm.module.css";

export const metadata = {
  title: "Oportunidade — Vamaq Motors",
  robots: { index: false, follow: false },
};

function veiculoLabel(o) {
  return rotuloVeiculo(o) || null;
}

function valorLabel(o) {
  return o.valor != null ? `R$ ${formatValorBR(Number(o.valor))}` : null;
}

export default async function OportunidadePage({ params }) {
  // O layout do /admin já barra por papel; aqui é defesa em profundidade,
  // igual à lista (src/app/admin/crm/page.js).
  await requireRole(["vendedor", "secretaria"]);
  const { id } = await params;
  const o = await getOportunidade(id);
  if (!o) notFound();

  const linhas = [
    ["Veículo", veiculoLabel(o)],
    ["Valor", valorLabel(o)],
    ["Origem", o.origem],
    ["Telefone", o.telefone],
    ["E-mail", o.email],
    ["Observações", o.obs],
  ];
  if (o.etapa === "perdido") linhas.push(["Motivo da perda", o.motivo_perda]);

  return (
    <>
      <Link href="/admin/crm" className={crm.voltar}>
        ← Voltar
      </Link>

      <div className={crm.detailHead}>
        <h1 className={crm.detailNome}>{o.cliente_nome}</h1>
        <span
          className={`${crm.etapaBadge} ${o.etapa === "ganho" ? crm.etapaBadgeGanho : ""} ${
            o.etapa === "perdido" ? crm.etapaBadgePerdido : ""
          }`}
        >
          {rotuloEtapa(o.etapa)}
        </span>
      </div>

      <div className={crm.dados}>
        {linhas.map(([label, value]) => (
          <div key={label} className={crm.dadoRow}>
            <span className={crm.dadoLabel}>{label}</span>
            <span className={crm.dadoValue}>{value || "—"}</span>
          </div>
        ))}
      </div>

      <AcoesCard oportunidade={o} />
    </>
  );
}
