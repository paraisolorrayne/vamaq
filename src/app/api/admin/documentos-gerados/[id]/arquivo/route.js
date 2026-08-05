import fs from "fs/promises";
import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { getDocumentoArquivo } from "@/lib/documentos";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const auth = await requireApiRole(["vendedor", "secretaria"]);
  if (auth.error) return auth.error;

  const { id } = await params;
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
    },
  });
}
