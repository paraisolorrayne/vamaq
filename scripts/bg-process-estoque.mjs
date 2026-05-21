#!/usr/bin/env node
/**
 * Aplica bg-removal (mesmo pipeline do /api/admin/upload) nas fotos dos
 * veículos já cadastrados e atualiza o `images` jsonb para apontar para os
 * webp tratados em public/images/vehicles/.
 *
 * Usa as fotos atuais de cada veículo (images.gallery). Processa todas e
 * regrava { main, gallery } com os novos webp.
 *
 * Idempotente: se o veículo já aponta para /images/vehicles/ (já tratado),
 * pula. Para reprocessar, passe FORCE=1.
 *
 * Roda na VPS (deps nativas sharp/@imgly/onnx):
 *   DATABASE_URL=... node scripts/bg-process-estoque.mjs
 *   # opcional: SLUGS="slug1,slug2"  FORCE=1
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { removeBackground } from '@imgly/background-removal-node';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ Defina DATABASE_URL.');
  process.exit(1);
}
const FORCE = process.env.FORCE === '1';
const ONLY = (process.env.SLUGS || '').split(',').map((s) => s.trim()).filter(Boolean);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT_DIR = path.join(PUBLIC, 'images', 'vehicles');
const ICE_WHITE = { r: 245, g: 245, b: 240 };

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

async function createGradientBackground(w, h) {
  const pixels = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const r = Math.round(ICE_WHITE.r - t * 20);
    const g = Math.round(ICE_WHITE.g - t * 20);
    const b = Math.round(ICE_WHITE.b - t * 16);
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      pixels[idx] = r; pixels[idx + 1] = g; pixels[idx + 2] = b; pixels[idx + 3] = 255;
    }
  }
  return sharp(pixels, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

async function refineEdges(fgBuffer, w, h) {
  const { data } = await sharp(fgBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8Array(data);
  const output = Buffer.from(data);
  const radius = 5;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const a = pixels[idx + 3];
      if (a === 0 || a > 240) continue;
      let bestDist = Infinity, bestR = pixels[idx], bestG = pixels[idx + 1], bestB = pixels[idx + 2], found = false;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ny = y + dy, nx = x + dx;
          if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
          const nIdx = (ny * w + nx) * 4;
          if (pixels[nIdx + 3] > 240) {
            const dist = dx * dx + dy * dy;
            if (dist < bestDist) { bestDist = dist; bestR = pixels[nIdx]; bestG = pixels[nIdx + 1]; bestB = pixels[nIdx + 2]; found = true; }
          }
        }
      }
      if (found) { output[idx] = bestR; output[idx + 1] = bestG; output[idx + 2] = bestB; }
      else if (a < 100) { output[idx + 3] = 0; }
    }
  }
  return sharp(output, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
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
  return sharp(shadowPixels, { raw: { width: w, height: h, channels: 4 } })
    .blur(blurRadius > 0 ? blurRadius + (blurRadius % 2 === 0 ? 1 : 0) : 1)
    .png().toBuffer();
}

async function processOne(absPath) {
  const input = fs.readFileSync(absPath);
  const blob = new Blob([input], { type: 'image/jpeg' });
  const resultBlob = await removeBackground(blob, { output: { format: 'image/png' } });
  const fgPng = Buffer.from(await resultBlob.arrayBuffer());
  const meta = await sharp(fgPng).metadata();
  const w = meta.width, h = meta.height;
  const refined = await refineEdges(fgPng, w, h);
  const bg = await createGradientBackground(w, h);
  const shadow = await createDropShadow(refined, w, h);
  const out = await sharp(bg)
    .composite([{ input: shadow, blend: 'over' }, { input: refined, blend: 'over' }])
    .webp({ quality: 90 })
    .toBuffer();
  ensureDir(OUT_DIR);
  const filename = `${uuidv4()}.webp`;
  fs.writeFileSync(path.join(OUT_DIR, filename), out);
  return `/images/vehicles/${filename}`;
}

const { Pool } = pg;
const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });

async function main() {
  const { rows } = await pool.query(
    `select id, slug, images from vehicles where published = true order by created_at`
  );
  for (const v of rows) {
    if (ONLY.length && !ONLY.includes(v.slug)) continue;
    const images = v.images || { main: '', gallery: [] };
    const gallery = Array.isArray(images.gallery) ? images.gallery : [];
    if (!FORCE && (images.main || '').startsWith('/images/vehicles/')) {
      console.log(`✓ ${v.slug} já tratado — pulando (use FORCE=1 p/ refazer).`);
      continue;
    }
    const sources = (images.main ? [images.main, ...gallery.filter((u) => u !== images.main)] : gallery)
      .filter((u) => u && u.startsWith('/veiculos/'));
    if (!sources.length) { console.log(`⏭️  ${v.slug} sem fotos cruas — pulando.`); continue; }

    console.log(`🎨 ${v.slug}: processando ${sources.length} foto(s)...`);
    const newUrls = [];
    for (const u of sources) {
      const abs = path.join(PUBLIC, u);
      if (!fs.existsSync(abs)) { console.warn(`   ⚠️  não achei ${u}`); continue; }
      try {
        const out = await processOne(abs);
        newUrls.push(out);
        process.stdout.write('.');
      } catch (e) {
        console.warn(`\n   ⚠️  falha em ${u}: ${e.message}`);
      }
    }
    process.stdout.write('\n');
    if (!newUrls.length) { console.warn(`   ⚠️  ${v.slug}: nada processado.`); continue; }
    const newImages = { main: newUrls[0], gallery: newUrls };
    await pool.query('update vehicles set images = $1::jsonb where id = $2', [JSON.stringify(newImages), v.id]);
    console.log(`   ✅ ${v.slug}: ${newUrls.length} webp, images atualizado.`);
  }
  await pool.end();
  console.log('\nConcluído.');
}

main().catch((e) => { console.error('Erro:', e); process.exit(1); });
