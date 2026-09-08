import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { totaisDoMes } from "@/lib/fiscal/notas";

export const dynamic = "force-dynamic";

/**
 * O fechamento fiscal do mês — o que o contador pergunta no fim de todo mês.
 *
 * GET /api/admin/fiscal/totais?ano=2026&mes=8
 *
 * Mesmo papel e mesmo par ano/mês da rota de XMLs: as duas respondem ao mesmo
 * ritual de fechamento, e a tela usa um seletor só para as duas.
 */
export async function GET(request) {
  const auth = await requireApiRole(["financeiro", "secretaria"]);
  if (auth.error) return auth.error;

  const sp = new URL(request.url).searchParams;
  const ano = parseInt(sp.get("ano"), 10);
  const mes = parseInt(sp.get("mes"), 10);
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return NextResponse.json({ error: "Informe ano e mês válidos." }, { status: 400 });
  }

  try {
    // Mês sem nota nenhuma NÃO é erro aqui (ao contrário do zip, que não teria
    // o que empacotar): "zero notas de compra" é uma resposta legítima para o
    // contador, e é o resumo zerado que a dá.
    return NextResponse.json(await totaisDoMes(ano, mes), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    console.error("Falha ao montar o fechamento fiscal do mês:", err);
    return NextResponse.json(
      { error: "Não foi possível calcular os totais agora. Tente de novo em instantes." },
      { status: 500 }
    );
  }
}
