import { NextResponse } from "next/server";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { removeBackground } from "@imgly/background-removal-node";

const UPLOAD_DIR = path.join(process.cwd(), "public", "images", "vehicles");
const ICE_WHITE = { r: 245, g: 245, b: 240, alpha: 255 };

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function createGradientBackground(w, h) {
  const pixels = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const r = Math.round(ICE_WHITE.r - t * 20);
    const g = Math.round(ICE_WHITE.g - t * 20);
    const b = Math.round(ICE_WHITE.b - t * 16);
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = 255;
    }
  }
  return sharp(pixels, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();
}

async function refineEdges(fgBuffer, w, h) {
  const { data } = await sharp(fgBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = new Uint8Array(data);
  const output = Buffer.from(data);
  const radius = 5;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const a = pixels[idx + 3];
      if (a === 0 || a > 240) continue;

      let bestDist = Infinity;
      let bestR = pixels[idx];
      let bestG = pixels[idx + 1];
      let bestB = pixels[idx + 2];
      let foundOpaque = false;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ny = y + dy;
          const nx = x + dx;
          if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
          const nIdx = (ny * w + nx) * 4;
          if (pixels[nIdx + 3] > 240) {
            const dist = dx * dx + dy * dy;
            if (dist < bestDist) {
              bestDist = dist;
              bestR = pixels[nIdx];
              bestG = pixels[nIdx + 1];
              bestB = pixels[nIdx + 2];
              foundOpaque = true;
            }
          }
        }
      }

      if (foundOpaque) {
        output[idx] = bestR;
        output[idx + 1] = bestG;
        output[idx + 2] = bestB;
      } else if (a < 100) {
        output[idx + 3] = 0;
      }
    }
  }

  return sharp(output, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();
}

async function createDropShadow(fgBuffer, w, h) {
  const fgMeta = await sharp(fgBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const fgPixels = new Uint8Array(fgMeta.data);
  const shadowPixels = Buffer.alloc(w * h * 4, 0);

  const offsetY = Math.round(h * 0.02);
  const blurRadius = Math.round(Math.min(w, h) * 0.015);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 4;
      const alpha = fgPixels[srcIdx + 3];
      if (alpha > 30) {
        const dy = y + offsetY;
        if (dy >= 0 && dy < h) {
          const dstIdx = (dy * w + x) * 4;
          shadowPixels[dstIdx + 3] = Math.max(shadowPixels[dstIdx + 3], Math.round(alpha * 0.3));
        }
      }
    }
  }

  let blurred = await sharp(shadowPixels, { raw: { width: w, height: h, channels: 4 } })
    .blur(blurRadius > 0 ? blurRadius + (blurRadius % 2 === 0 ? 1 : 0) : 1)
    .png()
    .toBuffer();

  return blurred;
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
      const mimeType = file.type || "image/png";
      const blob = new Blob([buffer], { type: mimeType });
      const resultBlob = await removeBackground(blob, {
        output: { format: "image/png" },
      });
      const resultArrayBuffer = await resultBlob.arrayBuffer();
      const fgPng = Buffer.from(resultArrayBuffer);

      const metadata = await sharp(fgPng).metadata();
      const w = metadata.width;
      const h = metadata.height;

      const refinedFg = await refineEdges(fgPng, w, h);

      const bgLayer = await createGradientBackground(w, h);
      const shadowLayer = await createDropShadow(refinedFg, w, h);

      buffer = await sharp(bgLayer)
        .composite([
          { input: shadowLayer, blend: "over" },
          { input: refinedFg, blend: "over" },
        ])
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
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
