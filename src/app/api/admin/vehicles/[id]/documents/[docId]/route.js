import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { requireApiRole } from "@/lib/auth/api";
import { getVehicleById, removeVehicleDocument } from "@/lib/vehicleStore";

const DOCS_ROOT = path.join(process.cwd(), "data", "vehicle-docs");

export const dynamic = "force-dynamic";

// Baixa/visualiza o documento — só com login (arquivo privado, fora de public/).
export async function GET(_request, { params }) {
  const auth = await requireApiRole();
  if (auth.error) return auth.error;

  const { id, docId } = await params;
  const vehicle = await getVehicleById(id);
  const doc = vehicle?.documentos?.find((d) => d.id === docId);
  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }

  try {
    // arquivo é sempre um nome gerado (uuid.ext); basename blinda contra traversal.
    const filePath = path.join(DOCS_ROOT, id, path.basename(doc.arquivo));
    const data = await fs.readFile(filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": doc.mimetype || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.nome || doc.arquivo)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("Vehicle document read error:", err);
    return NextResponse.json({ error: "Arquivo indisponível" }, { status: 404 });
  }
}

export async function DELETE(_request, { params }) {
  const auth = await requireApiRole();
  if (auth.error) return auth.error;

  const { id, docId } = await params;
  const { vehicle, removed } = await removeVehicleDocument(id, docId);
  if (!vehicle) {
    return NextResponse.json({ error: "Veículo não encontrado" }, { status: 404 });
  }
  if (removed?.arquivo) {
    try {
      await fs.unlink(path.join(DOCS_ROOT, id, path.basename(removed.arquivo)));
    } catch (err) {
      if (err.code !== "ENOENT") console.error("Doc unlink error:", err);
    }
  }
  return NextResponse.json({ documentos: vehicle.documentos || [] });
}
