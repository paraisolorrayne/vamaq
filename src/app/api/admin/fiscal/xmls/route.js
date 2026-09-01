import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { montarPacoteXmlDoMes } from "@/lib/fiscal/notas";

export const dynamic = "force-dynamic";
// Baixar dezenas de XMLs da Focus passa dos 10s padrão de uma serverless; na
// VPS o limite é o do Node, mas deixamos explícito para não depender do padrão.
export const maxDuration = 120;

/**
 * O pacote mensal de XMLs que a loja manda para a contabilidade.
 *
 * GET /api/admin/fiscal/xmls?ano=2026&mes=8  ->  xmls-vamaq-2026-08.zip
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
    const pacote = await montarPacoteXmlDoMes(ano, mes);
    // Mês sem nota nenhuma devolve recado, não um zip vazio: quem clicou
    // precisa saber que não há o que mandar, e não abrir um arquivo vazio na
    // frente do contador.
    if (pacote.vazio) {
      return NextResponse.json(
        { error: "Nenhuma nota com XML neste mês." },
        { status: 404 }
      );
    }

    return new NextResponse(pacote.zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${pacote.nome}"`,
        // Quantas vieram e quantas faltaram, para a tela avisar sem abrir o zip.
        "X-Notas-Total": String(pacote.total),
        "X-Notas-Faltando": String(pacote.faltando),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("Falha ao montar o pacote de XMLs:", err);
    return NextResponse.json(
      { error: "Não foi possível montar o pacote agora. Tente de novo em instantes." },
      { status: 500 }
    );
  }
}
