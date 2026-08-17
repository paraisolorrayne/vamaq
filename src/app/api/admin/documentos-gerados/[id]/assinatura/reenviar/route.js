import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { reenviarNotificacao } from "@/lib/assinatura/envio";

export const dynamic = "force-dynamic";

/**
 * Reenvia o e-mail de assinatura para quem ainda não assinou.
 *
 * Rota separada do POST de envio de propósito: os dois parecem "mandar de
 * novo" para quem olha a tela, mas um sobe um documento novo (gasta cota, cria
 * um segundo link) e o outro só repete a notificação do que já está lá. Juntar
 * os dois num mesmo endpoint com um flag seria convidar a chamar o caro por
 * engano.
 */
export async function POST(_request, { params }) {
  const auth = await requireApiRole(["vendedor", "secretaria"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const res = await reenviarNotificacao(id);
    if (res.error) return NextResponse.json(res, { status: 400 });
    return NextResponse.json({ ok: true, ...res });
  } catch (err) {
    console.error("Falha ao reenviar notificação de assinatura:", err);
    return NextResponse.json(
      { error: err.message || "Falha ao reenviar" },
      { status: 502 }
    );
  }
}
