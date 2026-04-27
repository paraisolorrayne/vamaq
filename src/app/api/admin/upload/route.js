import { NextResponse } from "next/server";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const UPLOAD_DIR = path.join(process.cwd(), "public", "images", "vehicles");
const ICE_WHITE = { r: 245, g: 245, b: 240, alpha: 255 };

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const removeBg = formData.get("removeBg") === "true";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);

    ensureDir(UPLOAD_DIR);
    const filename = `${uuidv4()}.webp`;
    const filepath = path.join(UPLOAD_DIR, filename);

    if (removeBg) {
      const image = sharp(buffer);
      const metadata = await image.metadata();
      const w = metadata.width;
      const h = metadata.height;

      const { data, info } = await image
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const pixels = new Uint8Array(data);
      const channels = info.channels;

      const cornerSamples = [];
      const sampleSize = Math.max(1, Math.floor(Math.min(w, h) * 0.05));
      for (let y = 0; y < sampleSize; y++) {
        for (let x = 0; x < sampleSize; x++) {
          const idx = (y * w + x) * channels;
          cornerSamples.push({ r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2] });
        }
      }
      for (let y = 0; y < sampleSize; y++) {
        for (let x = w - sampleSize; x < w; x++) {
          const idx = (y * w + x) * channels;
          cornerSamples.push({ r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2] });
        }
      }
      for (let y = h - sampleSize; y < h; y++) {
        for (let x = 0; x < sampleSize; x++) {
          const idx = (y * w + x) * channels;
          cornerSamples.push({ r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2] });
        }
      }
      for (let y = h - sampleSize; y < h; y++) {
        for (let x = w - sampleSize; x < w; x++) {
          const idx = (y * w + x) * channels;
          cornerSamples.push({ r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2] });
        }
      }

      const avgR = Math.round(cornerSamples.reduce((s, c) => s + c.r, 0) / cornerSamples.length);
      const avgG = Math.round(cornerSamples.reduce((s, c) => s + c.g, 0) / cornerSamples.length);
      const avgB = Math.round(cornerSamples.reduce((s, c) => s + c.b, 0) / cornerSamples.length);

      const tolerance = 60;
      for (let i = 0; i < pixels.length; i += channels) {
        const dr = Math.abs(pixels[i] - avgR);
        const dg = Math.abs(pixels[i + 1] - avgG);
        const db = Math.abs(pixels[i + 2] - avgB);
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        if (dist < tolerance) {
          pixels[i + 3] = 0;
        } else if (dist < tolerance + 30) {
          const fade = (dist - tolerance) / 30;
          pixels[i + 3] = Math.round(255 * fade);
        }
      }

      const bgLayer = await sharp({
        create: {
          width: w,
          height: h,
          channels: 4,
          background: ICE_WHITE,
        },
      })
        .png()
        .toBuffer();

      const fgLayer = await sharp(Buffer.from(pixels.buffer), {
        raw: { width: w, height: h, channels: 4 },
      })
        .png()
        .toBuffer();

      buffer = await sharp(bgLayer)
        .composite([{ input: fgLayer, blend: "over" }])
        .webp({ quality: 90 })
        .toBuffer();
    } else {
      buffer = await sharp(buffer).webp({ quality: 90 }).toBuffer();
    }

    fs.writeFileSync(filepath, buffer);

    return NextResponse.json({
      url: `/images/vehicles/${filename}`,
      filename,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Upload failed", details: err.message },
      { status: 500 }
    );
  }
}
