/**
 * Vehicle repository — fonte única de dados do site público (Postgres).
 *
 * Lê direto do Postgres via `pg` (sem Supabase). Se `DATABASE_URL` não estiver
 * definida, as listas retornam vazias (ver src/lib/db.js) — o site não esconde
 * isso com mock.
 *
 * As fotos são arquivos estáticos servidos de /public/veiculos/<slug>/ e o
 * caminho público vem de `vehicle_images.url`.
 *
 * Toda função é async — páginas server-side usam `await`.
 */

import { query } from '@/lib/db';

/* ------------------------------------------------------------------ */
/* SELECT base + DB row → UI shape                                     */
/* ------------------------------------------------------------------ */

const VEHICLE_SELECT = `
  select
    v.id, v.slug, v.brand, v.model, v.year, v.body_type, v.color,
    v.price, v.mileage, v.badge, v.featured,
    v.fuel, v.transmission, v.power,
    v.spec_engine, v.spec_acceleration, v.spec_top_speed,
    v.spec_doors, v.spec_seats,
    v.description, v.status, v.published_at,
    coalesce(
      (
        select json_agg(vi.url order by vi.is_primary desc, vi.position asc)
        from vehicle_images vi
        where vi.vehicle_id = v.id
      ),
      '[]'::json
    ) as image_urls
  from vehicles v
`;

function rowToVehicle(row) {
  if (!row) return null;

  const urls = Array.isArray(row.image_urls) ? row.image_urls.filter(Boolean) : [];

  return {
    id: row.id,
    slug: row.slug,
    brand: row.brand,
    model: row.model,
    year: row.year,
    bodyType: row.body_type,
    color: row.color,
    price: row.price !== null ? Number(row.price) : null,
    mileage: row.mileage,
    badge: row.badge,
    featured: row.featured,
    fuel: row.fuel,
    transmission: row.transmission,
    power: row.power,
    description: row.description || '',
    status: row.status,
    publishedAt: row.published_at,
    images: {
      main: urls[0] || null,
      gallery: urls,
    },
    specs: {
      engine: row.spec_engine || '',
      acceleration: row.spec_acceleration || '',
      topSpeed: row.spec_top_speed || '',
      doors: row.spec_doors ?? null,
      seats: row.spec_seats ?? null,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function getAllVehicles(filters = {}) {
  const where = [`v.status = 'published'`];
  const params = [];

  const addInFilter = (column, value) => {
    const list = Array.isArray(value) ? value : [value];
    if (!list.length) return;
    params.push(list);
    where.push(`v.${column} = any($${params.length})`);
  };

  if (filters?.brand?.length) addInFilter('brand', filters.brand);
  if (filters?.bodyType?.length) addInFilter('body_type', filters.bodyType);
  if (filters?.fuel?.length) addInFilter('fuel', filters.fuel);

  if (filters?.minYear) {
    params.push(filters.minYear);
    where.push(`v.year >= $${params.length}`);
  }
  if (filters?.maxYear) {
    params.push(filters.maxYear);
    where.push(`v.year <= $${params.length}`);
  }
  if (filters?.maxMileage) {
    params.push(filters.maxMileage);
    where.push(`v.mileage <= $${params.length}`);
  }
  if (filters?.search) {
    params.push(`%${filters.search}%`);
    const i = params.length;
    where.push(`(v.brand ilike $${i} or v.model ilike $${i} or v.color ilike $${i})`);
  }

  const sql = `${VEHICLE_SELECT} where ${where.join(' and ')} order by v.published_at desc nulls last`;

  try {
    const { rows } = await query(sql, params);
    return rows.map(rowToVehicle);
  } catch (err) {
    console.error('[vehicles repo] getAllVehicles error:', err);
    return [];
  }
}

export async function getFeaturedVehicles(limit = 6) {
  const sql = `${VEHICLE_SELECT}
    where v.status = 'published' and v.featured = true
    order by v.published_at desc nulls last
    limit $1`;
  try {
    const { rows } = await query(sql, [limit]);
    return rows.map(rowToVehicle);
  } catch (err) {
    console.error('[vehicles repo] getFeaturedVehicles error:', err);
    return [];
  }
}

export async function getVehicleBySlug(slug) {
  if (!slug) return null;
  const sql = `${VEHICLE_SELECT} where v.slug = $1 and v.status = 'published' limit 1`;
  try {
    const { rows } = await query(sql, [slug]);
    return rows.length ? rowToVehicle(rows[0]) : null;
  } catch (err) {
    console.error('[vehicles repo] getVehicleBySlug error:', err);
    return null;
  }
}

export async function getRelatedVehicles(vehicle, limit = 3) {
  if (!vehicle) return [];
  const sql = `${VEHICLE_SELECT}
    where v.status = 'published'
      and v.slug <> $1
      and (v.brand = $2 or v.body_type = $3)
    order by v.published_at desc nulls last
    limit $4`;
  try {
    const { rows } = await query(sql, [
      vehicle.slug,
      vehicle.brand,
      vehicle.bodyType,
      limit,
    ]);
    return rows.map(rowToVehicle);
  } catch (err) {
    console.error('[vehicles repo] getRelatedVehicles error:', err);
    return [];
  }
}

export async function getAllSlugs() {
  try {
    const { rows } = await query(
      `select slug from vehicles where status = 'published'`
    );
    return rows.map((r) => r.slug);
  } catch (err) {
    console.error('[vehicles repo] getAllSlugs error:', err);
    return [];
  }
}

/* --------- Faceted filter options (derivadas dos dados atuais) ---- */

export async function getBrands() {
  const list = await getAllVehicles();
  return [...new Set(list.map((v) => v.brand))].sort();
}

export async function getBodyTypes() {
  const list = await getAllVehicles();
  return [...new Set(list.map((v) => v.bodyType))].sort();
}

export async function getFuelTypes() {
  const list = await getAllVehicles();
  return [...new Set(list.map((v) => v.fuel))].sort();
}

/* --------- Sorting (helper puro, sem DB) -------------------------- */

export function sortVehicles(list, sortBy) {
  const sorted = [...list];
  switch (sortBy) {
    case 'recent':
      return sorted.sort((a, b) => b.year - a.year);
    case 'mileage':
      return sorted.sort((a, b) => a.mileage - b.mileage);
    case 'brand':
      return sorted.sort((a, b) => a.brand.localeCompare(b.brand));
    default:
      return sorted;
  }
}

/* --------- WhatsApp helpers (re-export do módulo neutro) ---------- */

export {
  WHATSAPP_NUMBER,
  getWhatsAppUrl,
  getWhatsAppGenericUrl,
} from '@/lib/whatsapp';
