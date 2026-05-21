#!/usr/bin/env node
/**
 * Repõe `images` (main/gallery) dos veículos publicados a partir das fotos
 * ORIGINAIS em public/veiculos/<slug>/ — desfaz o bg-removal quando o recorte
 * automático ficou ruim. Re-executável.
 *
 * Uso: DATABASE_URL=... node scripts/set-photos-raw.mjs
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('❌ Defina DATABASE_URL.'); process.exit(1); }

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_VEICULOS = path.join(__dirname, '..', 'public', 'veiculos');

const PRIMARY_PREFIX = {
  'porsche-cayenne-coupe-platinum-2022': '00000260',
  'bmw-320i-m-sport-2022': '00000272',
  'dodge-ram-2500-rebel-2021': '00000289',
  'bmw-x4-m40i-2024': '00000469',
};

const { Pool } = pg;
const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });

async function rawImages(slug) {
  let files;
  try {
    files = (await readdir(path.join(PUBLIC_VEICULOS, slug)))
      .filter((n) => /\.jpe?g$/i.test(n)).sort((a, b) => a.localeCompare(b));
  } catch { return null; }
  if (!files.length) return null;
  const prefix = PRIMARY_PREFIX[slug];
  const idx = prefix ? files.findIndex((f) => f.startsWith(prefix)) : 0;
  if (idx > 0) { const [p] = files.splice(idx, 1); files.unshift(p); }
  const urls = files.map((f) => `/veiculos/${slug}/${f}`);
  return { main: urls[0], gallery: urls };
}

async function main() {
  const { rows } = await pool.query('select id, slug from vehicles where published = true');
  for (const v of rows) {
    const imgs = await rawImages(v.slug);
    if (!imgs) { console.log(`⏭️  ${v.slug}: sem fotos cruas`); continue; }
    await pool.query('update vehicles set images = $1::jsonb where id = $2', [JSON.stringify(imgs), v.id]);
    console.log(`✅ ${v.slug}: ${imgs.gallery.length} fotos originais`);
  }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
