import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import {
  enviarParaAssinatura,
  garantirAssignment,
  garantirViaAssinada,
} from "@/lib/assinatura/envio";
import { getEnvioAtual, listEnviosDoDocumento } from "@/lib/assinatura/repo";
import { assinafyEnabled } from "@/lib/assinatura/client";

export const dynamic = "force-dynamic";

/** Situação da assinatura de um documento, com o histórico de tentativas. */
export async function GET(_request, { params }) {
  const auth = await requireApiRole(["vendedor", "secretaria"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    let atual = await getEnvioAtual(id);

    // Dois serviços inacabados são terminados aqui, ao abrir a tela. Nenhum
    // dos dois pode depender só do webhook: em desenvolvimento ele não existe,
    // e em produção ele chega cedo demais para o segundo caso.
    //
    //   1. PDF subiu mas o pedido de assinatura não saiu — o processamento do
    //      Assinafy demorou mais que o poll do envio.
    //   2. Todos assinaram mas a via certificada não veio — o `document_ready`
    //      dispara ainda em `certificating`, e não existe evento para quando a
    //      certificação termina.
    //
    // As duas são idempotentes: se não houver nada a fazer, não fazem nada.
    if (atual && assinafyEnabled()) {
      try {
        if (!atual.assinafy_assignment_id) {
          atual = await garantirAssignment(atual);
        } else if (!atual.arquivo_assinado && atual.status === "certificating") {
          atual = (await garantirViaAssinada(atual.assinafy_document_id)) || atual;
        }
      } catch (err) {
        // Falar com o Assinafy pode falhar; consultar o status, não. Registra
        // e devolve o que temos no banco.
        console.error("Falha ao retomar a assinatura:", err);
      }
    }

    return NextResponse.json({
      configurado: assinafyEnabled(),
      atual: atual || null,
      historico: await listEnviosDoDocumento(id),
    });
  } catch (err) {
    console.error("Falha ao consultar assinatura:", err);
    return NextResponse.json({ error: "Falha ao consultar a assinatura" }, { status: 500 });
  }
}

/** Envia o contrato para assinatura. */
export async function POST(request, { params }) {
  const auth = await requireApiRole(["vendedor", "secretaria"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  let body = {};
  try {
    body = await request.json();
  } catch {
    // corpo vazio é legítimo: o e-mail costuma vir do cadastro do cliente
  }

  try {
    const res = await enviarParaAssinatura({
      documentoId: id,
      emailCliente: String(body.email || "").trim() || null,
      nomeCliente: String(body.nome || "").trim() || null,
      usuarioId: auth.user.id,
    });
    if (res.error) return NextResponse.json(res, { status: 400 });
    return NextResponse.json({ ok: true, ...res });
  } catch (err) {
    console.error("Falha ao enviar para assinatura:", err);
    // A mensagem do Assinafy diz o que corrigir (e-mail inválido, PDF acima do
    // limite); engolir isso deixaria a Mayra sem saber o que fazer.
    return NextResponse.json(
      { error: err.message || "Falha ao enviar para assinatura" },
      { status: 502 }
    );
  }
}
