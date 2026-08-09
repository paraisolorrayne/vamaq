"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { acoesDaEtapa, rotuloEtapa } from "@/lib/crm/etapas";
import { anoVeiculo } from "@/lib/anoVeiculo";
import crm from "../crm.module.css";

// `src/lib/whatsapp.js` monta o link para o WhatsApp *da loja* (número fixo
// em WHATSAPP_NUMBER) — é o cliente chamando a Vamaq, usado no site público.
// Aqui é o inverso: o vendedor chama o telefone do cliente que já está na
// oportunidade. Não dá para reaproveitar getWhatsAppUrl/getWhatsAppGenericUrl
// porque os dois cravam o número da loja como destino; o formato do link
// (wa.me + texto codificado) é reproduzido à mão abaixo.
function mensagemWhatsapp(o) {
  const primeiroNome = (o.cliente_nome || "").trim().split(/\s+/)[0] || "";
  const saudacao = primeiroNome ? `Olá, ${primeiroNome}!` : "Olá!";
  const veiculo = o.vehicle_brand
    ? [o.vehicle_brand, o.vehicle_model, anoVeiculo({ year: o.vehicle_year, ano_modelo: o.vehicle_ano_modelo })]
        .filter(Boolean)
        .join(" ")
    : null;
  return veiculo
    ? `${saudacao} Aqui é da Vamaq Motors, sobre o ${veiculo} que você está negociando com a gente — podemos continuar?`
    : `${saudacao} Aqui é da Vamaq Motors, tudo bem? Vamos continuar o seu atendimento.`;
}

function linkWhatsapp(o) {
  const digitos = String(o.telefone ?? "").replace(/\D/g, "");
  const texto = encodeURIComponent(mensagemWhatsapp(o));
  return `https://wa.me/${digitos}?text=${texto}`;
}

export default function AcoesCard({ oportunidade: o }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const acoes = acoesDaEtapa(o);

  async function mudarEtapa(etapa) {
    setErro("");
    setCarregando(true);
    try {
      const res = await fetch(`/api/admin/crm/oportunidades/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etapa }),
      });
      if (!res.ok) throw new Error("Falha ao salvar");
      router.refresh();
    } catch {
      setErro("Não foi possível salvar. Verifique a conexão e tente de novo.");
      setCarregando(false);
    }
  }

  return (
    <div className={crm.acoes}>
      {erro && <p className={crm.acoesErro}>{erro}</p>}

      {acoes.avancarPara && (
        <button
          type="button"
          className={crm.btnPrimario}
          disabled={carregando}
          onClick={() => mudarEtapa(acoes.avancarPara)}
        >
          Avançar para {rotuloEtapa(acoes.avancarPara)}
        </button>
      )}

      {acoes.podeWhatsapp && (
        <a href={linkWhatsapp(o)} target="_blank" rel="noopener noreferrer" className={crm.btnSecundario}>
          Chamar no WhatsApp
        </a>
      )}

      {acoes.podeVender && (
        <Link href={`/admin/crm/${o.id}/vender`} className={crm.btnSecundario}>
          Registrar venda
        </Link>
      )}

      {acoes.podePerder && (
        <Link href={`/admin/crm/${o.id}/perder`} className={crm.btnPerder}>
          Marcar como perdido
        </Link>
      )}

      {acoes.podeReabrir && (
        <button
          type="button"
          className={crm.btnPrimario}
          disabled={carregando}
          onClick={() => mudarEtapa("novo")}
        >
          Reabrir oportunidade
        </button>
      )}

      <div className={crm.gerenciarRow}>
        <Link href={`/admin/crm/${o.id}/editar`} className={crm.gerenciarItem}>
          Editar
        </Link>
        <Link href={`/admin/crm/${o.id}/mover`} className={crm.gerenciarItem}>
          Mover
        </Link>
        <Link href={`/admin/crm/${o.id}/remover`} className={crm.gerenciarItem}>
          Remover
        </Link>
      </div>
    </div>
  );
}
