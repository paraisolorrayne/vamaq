import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { getDocumentoDados } from "@/lib/documentos";

export const dynamic = "force-dynamic";

/**
 * Os campos digitados de um contrato, para reabrir e corrigir.
 *
 * Rota própria, fora da listagem, porque devolve dado pessoal (CPF, CNH,
 * endereço). A lista mostra dezenas de contratos e não precisa de nada disso —
 * mandá-los junto colocaria os documentos de todos os clientes no navegador de
 * qualquer pessoa que abrisse a tela.
 */
export async function GET(_request, { params }) {
  const auth = await requireApiRole(["vendedor", "secretaria"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const doc = await getDocumentoDados(id);
    if (!doc) {
      // Contrato gerado antes de 18/08/2026 não tem os campos guardados —
      // só o PDF. Não dá para corrigir, e a tela precisa saber disso.
      return NextResponse.json(
        { error: "Este contrato não guardou os campos preenchidos." },
        { status: 404 }
      );
    }
    return NextResponse.json({ documento: doc });
  } catch (err) {
    console.error("Falha ao ler os dados do documento:", err);
    return NextResponse.json({ error: "Falha ao ler o documento" }, { status: 500 });
  }
}
