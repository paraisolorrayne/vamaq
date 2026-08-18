import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { salvarDocumento, listDocumentos, listDocumentosDoVeiculo } from "@/lib/documentos";

export const dynamic = "force-dynamic";

function parseDados(bruto) {
  if (typeof bruto !== "string" || !bruto) return null;
  try {
    const v = JSON.parse(bruto);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

export async function GET(request) {
  const auth = await requireApiRole(["vendedor", "secretaria"]);
  if (auth.error) return auth.error;
  const params = new URL(request.url).searchParams;
  const vehicleId = params.get("vehicleId") || "";
  const busca = params.get("busca") || "";
  try {
    const documentos = vehicleId
      ? await listDocumentosDoVeiculo(vehicleId)
      : await listDocumentos({ busca });
    return NextResponse.json({ documentos });
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
      clienteId: String(formData.get("clienteId") || "").slice(0, 200) || null,
      vehicleId: String(formData.get("vehicleId") || "").slice(0, 200) || null,
      criadoPor: auth.user.id,
      buffer: Buffer.from(await file.arrayBuffer()),
      // Os campos digitados, para o contrato poder ser corrigido depois sem
      // preencher a minuta inteira de novo. JSON inválido não derruba a
      // gravação: o contrato vale mais que a possibilidade de reeditá-lo.
      dados: parseDados(formData.get("dados")),
      corrigeDocumentoId: String(formData.get("corrigeDocumentoId") || "") || null,
    });
    if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true, id: res.documento.id });
  } catch (err) {
    console.error("Falha ao guardar documento:", err);
    return NextResponse.json({ error: "Falha ao guardar o documento" }, { status: 500 });
  }
}
