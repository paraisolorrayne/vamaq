import fs from "fs/promises";
import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { caminhoAbsolutoDoArquivo } from "@/lib/documentos";
import { getEnvioAtual } from "@/lib/assinatura/repo";

export const dynamic = "force-dynamic";

/** A via assinada (PDF certificado) de um documento. 404 enquanto não voltou. */
export async function GET(_request, { params }) {
  const auth = await requireApiRole(["vendedor", "secretaria"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const envio = await getEnvioAtual(id);
    if (!envio?.arquivo_assinado) {
      return NextResponse.json({ error: "Ainda não há via assinada" }, { status: 404 });
    }
    const caminho = await caminhoAbsolutoDoArquivo(envio.arquivo_assinado);
    if (!caminho) {
      return NextResponse.json({ error: "Arquivo indisponível" }, { status: 404 });
    }
    const arquivo = await fs.readFile(caminho);
    return new NextResponse(arquivo, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="assinado-${id}.pdf"`,
        // Mesma regra do original: contrato com CPF e endereço não vai a cache.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("Falha ao ler via assinada:", err);
    return NextResponse.json({ error: "Arquivo indisponível" }, { status: 404 });
  }
}
