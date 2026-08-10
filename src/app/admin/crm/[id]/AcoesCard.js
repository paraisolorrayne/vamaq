"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { acoesDaEtapa, rotuloEtapa } from "@/lib/crm/etapas";
import { linkWhatsapp } from "@/lib/crm/whatsappVendedor";
import { precisaVincular } from "@/lib/crm/vinculoCliente";
import crm from "../crm.module.css";

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

      {precisaVincular(o) && (
        <Link href={`/admin/crm/${o.id}/vincular`} className={crm.btnSecundario}>
          Vincular a um cliente
        </Link>
      )}

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
