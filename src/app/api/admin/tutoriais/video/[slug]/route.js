import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { requireApiRole } from "@/lib/auth/api";


/**
 * Serve as demonstrações em vídeo dos tutoriais.
 *
 * Ficam FORA de public/ porque foram gravadas sobre o painel real: aparecem
 * valores, nomes de fornecedor e placas. Qualquer pessoa logada pode ver — é o
 * mesmo conteúdo das telas a que ela já tem acesso — mas a internet, não.
 *
 * Vivem em `midia/tutoriais/`, versionado no git: quem grava e publica sou eu,
 * junto com a mudança de tela que a gravação ilustra. Já existiu aqui uma tela
 * de upload para a equipe enviar .gif — ninguém na loja grava vídeo de tela, e
 * um botão que ninguém usa só ocupa espaço e gera dúvida. Removida em
 * 16/08/2026.
 */
const RAIZ = path.join(process.cwd(), "midia", "tutoriais");

// Só letras, números e hífen. Sem isto, "../../.env" viraria um caminho válido.
const SLUG_VALIDO = /^[a-z0-9-]{1,60}$/;

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const auth = await requireApiRole();
  if (auth.error) return auth.error;

  const { slug } = await params;
  if (!SLUG_VALIDO.test(String(slug))) {
    return NextResponse.json({ error: "Demonstração não encontrada." }, { status: 404 });
  }

  try {
    const conteudo = await fs.readFile(path.join(RAIZ, `${slug}.gif`));
    return new NextResponse(conteudo, {
      headers: {
        "Content-Type": "image/gif",
        // Privado e com cache: o arquivo é grande e não muda entre visitas.
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Demonstração não encontrada." }, { status: 404 });
  }
}
