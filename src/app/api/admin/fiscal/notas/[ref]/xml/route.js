import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { getNotaPorRef } from "@/lib/fiscal/notas";
import { baixarArquivo } from "@/lib/fiscal/focus/client";
import { nomeDoArquivo } from "@/lib/fiscal/pacote";

export const dynamic = "force-dynamic";

/**
 * O XML de UMA nota, como arquivo salvo — não como código na tela.
 *
 * O link do emissor não manda Content-Disposition, então o navegador
 * renderizava a árvore XML e não havia opção de salvar (a Mayra esbarrou nisso
 * em 01/09/2026, tentando mandar as notas para a contabilidade). Aqui o
 * arquivo passa por nós e desce com nome de verdade.
 */
export async function GET(_request, { params }) {
  const auth = await requireApiRole(["financeiro", "secretaria"]);
  if (auth.error) return auth.error;

  const { ref } = await params;
  const nota = await getNotaPorRef(ref);
  if (!nota?.xml_url) {
    return NextResponse.json({ error: "Esta nota não tem XML." }, { status: 404 });
  }

  try {
    const conteudo = await baixarArquivo(nota.xml_url);
    // O mesmo nome que o arquivo teria dentro do pacote mensal, sem a pasta:
    // quem baixa avulso e quem baixa em lote acaba com o mesmo nome de arquivo.
    const nome = nomeDoArquivo(nota).split("/").pop();
    return new NextResponse(conteudo, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nome}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error(`Falha ao baixar o XML da nota ${ref}:`, err);
    return NextResponse.json(
      { error: "Não foi possível baixar o XML agora." },
      { status: 502 }
    );
  }
}
