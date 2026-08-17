import crypto from "crypto";
import { NextResponse } from "next/server";
import { getDocument } from "@/lib/assinatura/client";
import { atualizarStatus, getEnvioPorAssinafyId } from "@/lib/assinatura/repo";
import { garantirViaAssinada, garantirAssignment } from "@/lib/assinatura/envio";

/**
 * Webhook do Assinafy.
 *
 * DUAS COISAS IMPORTANTES SOBRE SEGURANÇA AQUI:
 *
 * 1. O Assinafy NÃO assina os eventos. A configuração da inscrição aceita só
 *    url, events, is_active e email — não há segredo compartilhado nem header
 *    de assinatura para conferir. O que dá para fazer é pôr um segredo na
 *    própria URL cadastrada (?token=...), que é o que ASSINAFY_WEBHOOK_SECRET
 *    faz. Isso protege contra quem não conhece a URL, e nada mais.
 *
 * 2. Por isso o corpo do evento NÃO é fonte de verdade. Dele sai apenas o id
 *    do documento; o estado real é relido da API com a nossa chave antes de
 *    qualquer escrita. Um POST forjado com "documento assinado" não consegue
 *    marcar nada como assinado — no máximo faz o servidor reconsultar um
 *    documento que já é nosso.
 *
 * Fica fora de /api/admin porque quem chama é o Assinafy, sem sessão.
 */
export const dynamic = "force-dynamic";

/** Comparação em tempo constante — evita descobrir o segredo por cronometragem. */
function tokenConfere(recebido, esperado) {
  if (!recebido || !esperado) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Acha o id do documento no evento.
 *
 * A especificação deles não documenta o corpo enviado, só o histórico de
 * entrega. Enquanto não houver um evento real para conferir (GET
 * /v1/accounts/{id}/webhooks mostra os payloads já entregues), vale procurar
 * nos lugares plausíveis em vez de fixar um formato e quebrar calado.
 */
function extrairDocumentId(body) {
  return (
    body?.document?.id ||
    body?.data?.document?.id ||
    body?.data?.id ||
    body?.document_id ||
    body?.payload?.document?.id ||
    body?.payload?.document_id ||
    null
  );
}

export async function POST(request) {
  const esperado = process.env.ASSINAFY_WEBHOOK_SECRET;
  if (!esperado) {
    // Sem segredo configurado o endpoint fica desligado, em vez de aceitar
    // qualquer POST da internet.
    return NextResponse.json({ error: "Webhook desativado" }, { status: 503 });
  }
  const token = new URL(request.url).searchParams.get("token");
  if (!tokenConfere(token, esperado)) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const documentId = extrairDocumentId(body);
  if (!documentId) {
    // Pode ser um teste de conexão do painel deles. Aceita para não virar
    // erro na tela do Assinafy, mas registra o corpo — é assim que o formato
    // real vai ser descoberto.
    console.warn("Assinafy webhook sem id de documento:", JSON.stringify(body).slice(0, 1000));
    return NextResponse.json({ ok: true });
  }

  try {
    const envio = await getEnvioPorAssinafyId(documentId);
    if (!envio) {
      // Documento que não é nosso (ou de outro ambiente). Nada a fazer, e 200
      // para o Assinafy não ficar reentregando para sempre.
      return NextResponse.json({ ok: true, ignorado: true });
    }

    // Fonte de verdade: a API, não o corpo do evento.
    const doc = await getDocument(documentId);
    const status = doc?.status || envio.status;

    // Casa o que a API diz sobre cada signatário com a nossa lista, para a
    // tela poder mostrar "cliente assinou, falta a Vamaq".
    const assinados = new Map(
      (doc?.assignment?.signers || []).map((s) => [s.id, Boolean(s.completed)])
    );
    const signers = (Array.isArray(envio.signers) ? envio.signers : []).map((s) => ({
      ...s,
      assinado_em:
        s.assinado_em || (assinados.get(s.assinafy_signer_id) ? new Date().toISOString() : null),
    }));

    await atualizarStatus(documentId, {
      status,
      signers,
      recusaMotivo: doc?.decline_reason || null,
      raw: body,
    });

    // O PDF ficou pronto antes do poll do envio terminar — pede a assinatura
    // agora. Idempotente: se o assignment já existe, não faz nada.
    if (status === "metadata_ready" && !envio.assinafy_assignment_id) {
      await garantirAssignment({ ...envio, status });
    }

    // Todo mundo assinou: traz a via certificada para o cofre. É o passo que
    // dá valor ao resto — o PDF assinado guardado junto do original, no dossiê
    // do veículo, daqui a dois anos.
    //
    // A espera curta existe porque no `document_ready` o documento costuma
    // estar em `certificating`, e NÃO há evento para quando a certificação
    // termina. Se mesmo assim não ficar pronto, a tela termina o serviço ao
    // consultar o status — ver garantirViaAssinada().
    // A espera é curta de propósito: quem está do outro lado é o Assinafy
    // esperando o 200, e um handler que demora vira entrega falhada e
    // reentrega. Duas tentativas cobrem o caso rápido; o resto fica com a tela.
    if (status === "certificating" || status === "certificated") {
      await garantirViaAssinada(documentId, { tentativas: 2, intervaloMs: 2000 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // 500 de propósito: o Assinafy reentrega o que não recebeu 200, e as
    // operações deste handler são idempotentes.
    console.error("Assinafy webhook error:", err);
    return NextResponse.json({ error: "Falha ao processar" }, { status: 500 });
  }
}
