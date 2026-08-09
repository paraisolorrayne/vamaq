"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { acoesDaEtapa, rotuloEtapa } from "@/lib/crm/etapas";
import { telefoneWhatsapp } from "@/lib/crm/telefone";
import { rotuloVeiculo } from "@/lib/crm/rotuloVeiculo";
import crm from "../crm.module.css";

// `src/lib/whatsapp.js` monta o link para o WhatsApp *da loja* (número fixo
// em WHATSAPP_NUMBER) — é o cliente chamando a Vamaq, usado no site público.
// Aqui é o inverso: o vendedor chama o telefone do cliente que já está na
// oportunidade. Não dá para reaproveitar getWhatsAppUrl/getWhatsAppGenericUrl
// porque os dois cravam o número da loja como destino; o formato do link
// (wa.me + texto codificado) é reproduzido à mão abaixo — mas a normalização
// do telefone do cliente (DDI, para o wa.me não confundir DDD com país) é a
// mesma usada por `acoesDaEtapa` para decidir se `podeWhatsapp` é `true`,
// então quando este link é renderizado o número já é garantidamente válido.
function mensagemWhatsapp(o) {
  const primeiroNome = (o.cliente_nome || "").trim().split(/\s+/)[0] || "";
  const saudacao = primeiroNome ? `Olá, ${primeiroNome}!` : "Olá!";
  const veiculo = rotuloVeiculo(o) || null;
  return veiculo
    ? `${saudacao} Aqui é da Vamaq Motors, sobre o ${veiculo} que você está negociando com a gente — podemos continuar?`
    : `${saudacao} Aqui é da Vamaq Motors, tudo bem? Vamos continuar o seu atendimento.`;
}

function linkWhatsapp(o) {
  const numero = telefoneWhatsapp(o.telefone);
  const texto = encodeURIComponent(mensagemWhatsapp(o));
  return `https://wa.me/${numero}?text=${texto}`;
}

export default function AcoesCard({ oportunidade: o }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const acoes = acoesDaEtapa(o);
  // `router.refresh()` não bloqueia: dispara a nova busca do Server
  // Component e devolve na hora, antes de a tela mudar. Sem `useTransition`,
  // o `finally` (abaixo) já reabilitava o botão nesse mesmo tique — em uma
  // rede lenta a tela ficava idêntica por até ~1s, o vendedor achava que
  // não tocou certo e tocava de novo, pulando uma etapa (ex.: "Avançar para
  // Proposta" duas vezes leva direto a Negociação). `isPending` cobre
  // exatamente essa janela: só vira `false` quando o refresh — e a
  // re-renderização do pai com o novo estado — termina de verdade.
  const [isPending, startTransition] = useTransition();

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
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setErro("Não foi possível salvar. Verifique a conexão e tente de novo.");
    } finally {
      // `finally`, não só o `catch`: no sucesso, `router.refresh()`
      // re-renderiza o Server Component pai mas não desmonta este
      // AcoesCard (mesmo componente, mesma posição na árvore) — o estado
      // `carregando` sobrevive ao refresh. Sem isto, o botão "Avançar"
      // funciona uma vez e trava desabilitado para sempre, sem erro nenhum
      // na tela. Mas `carregando` sozinho não basta mais: quem mantém o
      // botão desabilitado até a tela realmente mudar é `isPending`
      // (`disabled={carregando || isPending}` abaixo).
      setCarregando(false);
    }
  }

  const desabilitado = carregando || isPending;

  return (
    <div className={crm.acoes}>
      {erro && <p className={crm.acoesErro}>{erro}</p>}

      {acoes.avancarPara && (
        <button
          type="button"
          className={crm.btnPrimario}
          disabled={desabilitado}
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
          disabled={desabilitado}
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
        <Link
          href={`/admin/crm/${o.id}/remover`}
          className={`${crm.gerenciarItem} ${crm.gerenciarItemPerigo}`}
        >
          Remover
        </Link>
      </div>
    </div>
  );
}
