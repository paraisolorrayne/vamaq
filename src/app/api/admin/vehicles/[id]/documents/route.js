import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { requireApiRole } from "@/lib/auth/api";
import { getVehicleById, addVehicleDocument } from "@/lib/vehicleStore";

// Documentos ficam FORA de public/ (contêm dados sensíveis: CRLV, CRV, NF).
// Guardados em data/vehicle-docs/<id>/, servidos só com login pela rota
// /api/admin/vehicles/[id]/documents/[docId].
const DOCS_ROOT = path.join(process.cwd(), "data", "vehicle-docs");
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

// Tipo (extensão) → mimetype aceito.
const ALLOWED = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
};

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const auth = await requireApiRole();
  if (auth.error) return auth.error;
  const { id } = await params;
  const vehicle = await getVehicleById(id);
  if (!vehicle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ documentos: vehicle.documentos || [] });
}

export async function POST(request, { params }) {
  const auth = await requireApiRole();
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const vehicle = await getVehicleById(id);
    if (!vehicle) {
      return NextResponse.json({ error: "Veículo não encontrado" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const tipo = String(formData.get("tipo") || "Documento").slice(0, 60);

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const ext = path.extname(file.name || "").toLowerCase();
    const mimetype = ALLOWED[ext];
    if (!mimetype) {
      return NextResponse.json(
        { error: "Formato não aceito (use PDF, JPG, PNG, WEBP ou HEIC)" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: "Arquivo acima de 20 MB" }, { status: 400 });
    }

    const dir = path.join(DOCS_ROOT, id);
    await fs.mkdir(dir, { recursive: true });
    const arquivo = `${uuidv4()}${ext}`;
    await fs.writeFile(path.join(dir, arquivo), buffer);

    const doc = {
      id: uuidv4(),
      tipo,
      nome: file.name || arquivo,
      arquivo,
      mimetype,
      tamanho: buffer.length,
      uploaded_at: new Date().toISOString(),
    };

    const updated = await addVehicleDocument(id, doc);
    return NextResponse.json({ documento: doc, documentos: updated?.documentos || [] }, { status: 201 });
  } catch (err) {
    console.error("Vehicle document upload error:", err);
    return NextResponse.json(
      { error: `Falha ao salvar o documento: ${err.message}` },
      { status: 500 }
    );
  }
}
