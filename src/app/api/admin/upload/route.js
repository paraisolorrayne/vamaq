import { NextResponse } from "next/server";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import heicConvert from "heic-convert";
import { requireApiRole } from "@/lib/auth/api";

// Fotos de iPhone chegam em HEIC, que o sharp pré-compilado do Linux não
// decodifica (codec HEVC é patenteado). Detecta pelos magic bytes (ftyp....)
// e converte para JPEG com heic-convert (JS puro) antes do pipeline.
const HEIC_BRANDS = ["heic", "heix", "hevc", "hevx", "heif", "mif1", "msf1"];

function isHeic(buffer) {
  if (buffer.length < 12) return false;
  if (buffer.toString("ascii", 4, 8) !== "ftyp") return false;
  return HEIC_BRANDS.includes(buffer.toString("ascii", 8, 12));
}

const UPLOAD_DIR = path.join(process.cwd(), "public", "images", "vehicles");
const ICE_WHITE = { r: 245, g: 245, b: 240, alpha: 255 };

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function POST(request) {
  const auth = await requireApiRole();
  if (auth.error) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);

    if (isHeic(buffer)) {
      buffer = Buffer.from(
        await heicConvert({ buffer, format: "JPEG", quality: 0.92 })
      );
    }

    // Fotos de celular chegam "deitadas" sem isso: aplica a orientação EXIF
    // antes de redimensionar.
    buffer = await sharp(buffer).rotate().toBuffer();

    ensureDir(UPLOAD_DIR);
    const filename = `${uuidv4()}.webp`;
    const filepath = path.join(UPLOAD_DIR, filename);

    buffer = await sharp(buffer)
      .resize(2560, 2560, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();

    fs.writeFileSync(filepath, buffer);

    return NextResponse.json({
      url: `/images/vehicles/${filename}`,
      filename,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: `Falha ao processar a imagem: ${err.message}` },
      { status: 500 }
    );
  }
}
