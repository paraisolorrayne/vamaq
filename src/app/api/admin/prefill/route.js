import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Rascunhos de uso único: JSONs em data/prefill/ (fora do git — contêm dados
// pessoais) com { id, templateId, label, note, values }. Aparecem como banner
// na página de Documentos e são apagados quando o PDF é baixado.
const PREFILL_DIR = path.join(process.cwd(), "data", "prefill");

export const dynamic = "force-dynamic";

function validId(id) {
  return typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(id);
}

export async function GET() {
  let files;
  try {
    files = await fs.readdir(PREFILL_DIR);
  } catch {
    return NextResponse.json({ prefills: [] });
  }
  const prefills = [];
  for (const file of files.filter((f) => f.endsWith(".json")).sort()) {
    try {
      const raw = await fs.readFile(path.join(PREFILL_DIR, file), "utf8");
      const data = JSON.parse(raw);
      if (validId(data.id) && data.templateId && data.values) {
        prefills.push(data);
      }
    } catch {
      // JSON inválido não derruba a listagem dos demais.
    }
  }
  return NextResponse.json({ prefills });
}

export async function DELETE(request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!validId(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }
  try {
    await fs.unlink(path.join(PREFILL_DIR, `${id}.json`));
  } catch (err) {
    if (err.code !== "ENOENT") {
      return NextResponse.json(
        { error: "Falha ao remover o rascunho" },
        { status: 500 }
      );
    }
  }
  return NextResponse.json({ ok: true });
}
