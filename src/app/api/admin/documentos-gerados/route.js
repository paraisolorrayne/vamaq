import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { salvarDocumento, listDocumentos } from "@/lib/documentos";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireApiRole(["vendedor", "secretaria"]);
  if (auth.error) return auth.error;
  const busca = new URL(request.url).searchParams.get("busca") || "";
  try {
    return NextResponse.json({ documentos: await listDocumentos({ busca }) });
  } catch (err) {
    console.error("Falha ao listar documentos:", err);
    return NextResponse.json({ error: "Falha ao listar os documentos" }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireApiRole(["vendedor", "secretaria"]);
  if (auth.error) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }
    const res = await salvarDocumento({
      tipo: String(formData.get("tipo") || ""),
      titulo: String(formData.get("titulo") || "").slice(0, 200),
      cliente: String(formData.get("cliente") || "").slice(0, 200) || null,
      vehicleId: String(formData.get("vehicleId") || "").slice(0, 200) || null,
      criadoPor: auth.user.id,
      buffer: Buffer.from(await file.arrayBuffer()),
    });
    if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true, id: res.documento.id });
  } catch (err) {
    console.error("Falha ao guardar documento:", err);
    return NextResponse.json({ error: "Falha ao guardar o documento" }, { status: 500 });
  }
}
