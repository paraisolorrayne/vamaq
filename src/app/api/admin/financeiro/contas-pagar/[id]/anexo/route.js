import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "node:crypto";
import { requireApiRole } from "@/lib/auth/api";
import { getBill, setBillAnexo } from "@/lib/fin/repositories/finance";

// Boletos e comprovantes ficam FORA de public/ — trazem código de barras,
// valores e dados bancários. Mesmo padrão dos documentos do veículo: arquivo
// em disco privado, servido só com login por esta rota.
const ROOT = path.join(process.cwd(), "data", "contas");
const MAX_BYTES = 20 * 1024 * 1024;

const ACEITOS = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
};

export const dynamic = "force-dynamic";

/** Baixa o anexo. */
export async function GET(_request, { params }) {
  const auth = await requireApiRole(["financeiro", "secretaria"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const bill = await getBill(id);
  if (!bill?.anexo?.arquivo) {
    return NextResponse.json({ error: "Esta conta não tem anexo." }, { status: 404 });
  }

  // O nome do arquivo é gerado por nós (uuid + extensão) e nunca vem do
  // cliente, mas a checagem fica: um dia alguém edita o jsonb à mão.
  const nome = path.basename(String(bill.anexo.arquivo));
  const caminho = path.join(ROOT, String(id), nome);
  try {
    const conteudo = await fs.readFile(caminho);
    return new NextResponse(conteudo, {
      headers: {
        "Content-Type": bill.anexo.mimetype || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(bill.anexo.nome || nome)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Arquivo não encontrado no servidor." }, { status: 404 });
  }
}

export async function POST(request, { params }) {
  const auth = await requireApiRole(["financeiro", "secretaria"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const bill = await getBill(id);
    if (!bill) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const ext = path.extname(file.name || "").toLowerCase();
    const mimetype = ACEITOS[ext];
    if (!mimetype) {
      return NextResponse.json(
        { error: "Formato não aceito — use PDF, JPG, PNG, WEBP ou HEIC." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: "Arquivo acima de 20 MB." }, { status: 400 });
    }

    const dir = path.join(ROOT, String(id));
    await fs.mkdir(dir, { recursive: true });
    const arquivo = `${randomUUID()}${ext}`;
    await fs.writeFile(path.join(dir, arquivo), buffer);

    const anexo = {
      nome: file.name || arquivo,
      arquivo,
      mimetype,
      tamanho: buffer.length,
      enviado_em: new Date().toISOString(),
    };
    return NextResponse.json(await setBillAnexo(id, anexo), { status: 201 });
  } catch (err) {
    console.error("Anexo de conta a pagar:", err);
    return NextResponse.json({ error: `Falha ao salvar: ${err.message}` }, { status: 500 });
  }
}
