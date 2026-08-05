import fs from "fs/promises";
import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { getDocumentoArquivo } from "@/lib/documentos";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const auth = await requireApiRole(["vendedor", "secretaria"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const doc = await getDocumentoArquivo(id);
    if (!doc) {
      return NextResponse.json(
        { error: "Documento não encontrado ou arquivo indisponível" },
        { status: 404 }
      );
    }
    const arquivo = await fs.readFile(doc.caminhoAbsoluto);
    return new NextResponse(arquivo, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${doc.titulo.replace(/[^\w.-]+/g, "_")}.pdf"`,
        // documento privado (contrato com CPF/endereço) — não pode ficar em cache.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    // banco fora do ar, ou o arquivo sumiu entre a checagem e a leitura (corrida
    // real, ainda que rara) — mesma mensagem do "não encontrado" para não vazar
    // detalhe de disco/banco na resposta.
    console.error("Falha ao ler documento:", err);
    return NextResponse.json(
      { error: "Documento não encontrado ou arquivo indisponível" },
      { status: 404 }
    );
  }
}
