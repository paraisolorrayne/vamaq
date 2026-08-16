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
 */
const RAIZ = path.join(process.cwd(), "data", "tutoriais");

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

/**
 * Envia (ou substitui) a gravação de um passo. Só admin — é conteúdo que toda
 * a equipe vai ver como instrução oficial.
 *
 * Guardar pelo painel, e não por cópia de arquivo no servidor, é o que permite
 * regravar um passo quando a tela mudar sem depender de acesso ao servidor.
 */
export async function POST(request, { params }) {
  const auth = await requireApiRole(["admin"]);
  if (auth.error) return auth.error;

  const { slug } = await params;
  if (!SLUG_VALIDO.test(String(slug))) {
    return NextResponse.json({ error: "Nome de demonstração inválido." }, { status: 400 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }
    if (!/\.gif$/i.test(file.name || "")) {
      return NextResponse.json({ error: "Envie um arquivo .gif." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Gravação acima de 25 MB." }, { status: 400 });
    }

    await fs.mkdir(RAIZ, { recursive: true });
    await fs.writeFile(path.join(RAIZ, `${slug}.gif`), buffer);
    return NextResponse.json({ slug, tamanho: buffer.length }, { status: 201 });
  } catch (err) {
    console.error("Upload de demonstração:", err);
    return NextResponse.json({ error: `Falha ao salvar: ${err.message}` }, { status: 500 });
  }
}
