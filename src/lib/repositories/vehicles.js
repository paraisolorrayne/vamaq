/**
 * Vehicle repository — fonte única de dados do site público (Postgres).
 *
 * Lê do Postgres via `pg`. Sem DATABASE_URL, retorna listas vazias.
 * Shape no banco: colunas escalares + jsonb (images {main,gallery}, specs).
 * Só veículos `published = true` aparecem no site.
 */

import { query } from '@/lib/db';

const SELECT = `
  select id, slug, brand, model, year, price, quilometragem,
         fuel, transmission, power, color, body_type, featured, badge,
         images, specs, description
  from vehicles
`;

function rowToVehicle(row) {
  if (!row) return null;
  const images = row.images || { main: '', gallery: [] };
  const gallery = Array.isArray(images.gallery) ? images.gallery.filter(Boolean) : [];
  const main = images.main || gallery[0] || null;
  const specs = row.specs || {};
  return {
    id: row.id,
    slug: row.slug,
    brand: row.brand,
    model: row.model,
    year: row.year,
    bodyType: row.body_type,
    color: row.color,
    price: row.price !== null && row.price !== undefined ? Number(row.price) : null,
    mileage: row.quilometragem,
    badge: row.badge,
    featured: row.featured,
    fuel: row.fuel,
    transmission: row.transmission,
    power: row.power,
    description: row.description || '',
    images: {
      main,
      gallery: main ? [main, ...gallery.filter((u) => u !== main)] : gallery,
    },
    specs: {
      engine: specs.engine || '',
      acceleration: specs.acceleration || '',
      topSpeed: specs.topSpeed || '',
      doors: specs.doors ?? null,
      seats: specs.seats ?? null,
    },
  };
}

export async function getAllVehicles(filters = {}) {
  const where = ['published = true'];
  const params = [];

  const addIn = (col, val) => {
    const list = Array.isArray(val) ? val : [val];
    if (!list.length) return;
    params.push(list);
    where.push(`${col} = any($${params.length})`);
  };

  if (filters?.brand?.length) addIn('brand', filters.brand);
  if (filters?.bodyType?.length) addIn('body_type', filters.bodyType);
  if (filters?.fuel?.length) addIn('fuel', filters.fuel);
  if (filters?.minYear) { params.push(filters.minYear); where.push(`year >= $${params.length}`); }
  if (filters?.maxYear) { params.push(filters.maxYear); where.push(`year <= $${params.length}`); }
  if (filters?.maxMileage) { params.push(filters.maxMileage); where.push(`quilometragem <= $${params.length}`); }
  if (filters?.search) {
    params.push(`%${filters.search}%`);
    const i = params.length;
    where.push(`(brand ilike $${i} or model ilike $${i} or color ilike $${i})`);
  }

  const sql = `${SELECT} where ${where.join(' and ')} order by created_at desc`;
  try {
    const { rows } = await query(sql, params);
    return rows.map(rowToVehicle);
  } catch (err) {
    console.error('[vehicles repo] getAllVehicles error:', err);
    return [];
  }
}

export async function getFeaturedVehicles(limit = 6) {
  const sql = `${SELECT} where published = true and featured = true order by created_at desc limit $1`;
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
  const sql = `${SELECT} where slug = $1 and published = true limit 1`;
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
  const sql = `${SELECT}
    where published = true and slug <> $1 and (brand = $2 or body_type = $3)
    order by created_at desc limit $4`;
  try {
    const { rows } = await query(sql, [vehicle.slug, vehicle.brand, vehicle.bodyType, limit]);
    return rows.map(rowToVehicle);
  } catch (err) {
    console.error('[vehicles repo] getRelatedVehicles error:', err);
    return [];
  }
}

export async function getAllSlugs() {
  try {
    const { rows } = await query(`select slug from vehicles where published = true`);
    return rows.map((r) => r.slug);
  } catch (err) {
    console.error('[vehicles repo] getAllSlugs error:', err);
    return [];
  }
}

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

export {
  WHATSAPP_NUMBER,
  getWhatsAppUrl,
  getWhatsAppGenericUrl,
} from '@/lib/whatsapp';
