/**
 * Variante admin do repository de veículos.
 * Usa o cliente Supabase autenticado (Server) — RLS permite ver tudo
 * para users com role admin/editor.
 */
import { getServerSupabase } from '@/lib/supabase/server';

const VEHICLE_SELECT = `
  id, slug, brand, model, year, body_type, color,
  price, mileage, badge, featured,
  fuel, transmission, power,
  spec_engine, spec_acceleration, spec_top_speed, spec_doors, spec_seats,
  description, status, published_at,
  created_at, updated_at,
  vehicle_images (
    id, position, is_primary, processed_path, original_path, processing_status
  )
`;

function rowToVehicle(row) {
  if (!row) return null;
  const images = Array.isArray(row.vehicle_images) ? row.vehicle_images : [];
  const sorted = [...images].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return (a.position ?? 0) - (b.position ?? 0);
  });
  const publicUrls = sorted
    .map((img) => img.processed_url || img.processed_path || null)
    .filter(Boolean);

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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    images: {
      main: publicUrls[0] || null,
      gallery: publicUrls,
    },
    imageRows: sorted,
    specs: {
      engine: row.spec_engine || '',
      acceleration: row.spec_acceleration || '',
      topSpeed: row.spec_top_speed || '',
      doors: row.spec_doors ?? null,
      seats: row.spec_seats ?? null,
    },
  };
}

async function hydrateImages(supabase, rows) {
  if (!supabase || !rows?.length) return rows;
  for (const row of rows) {
    if (!Array.isArray(row.vehicle_images)) continue;
    for (const img of row.vehicle_images) {
      if (img.processed_path) {
        const { data } = supabase.storage
          .from('processed')
          .getPublicUrl(img.processed_path);
        img.processed_url = data?.publicUrl || null;
      }
    }
  }
  return rows;
}

export async function adminListVehicles() {
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('vehicles')
    .select(VEHICLE_SELECT)
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('[admin repo] list error:', error);
    return [];
  }
  await hydrateImages(supabase, data);
  return data.map(rowToVehicle);
}

export async function adminGetVehicleById(id) {
  if (!id) return null;
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('vehicles')
    .select(VEHICLE_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[admin repo] getById error:', error);
    return null;
  }
  if (!data) return null;
  await hydrateImages(supabase, [data]);
  return rowToVehicle(data);
}

export async function adminGetVehicleBySlug(slug) {
  if (!slug) return null;
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('vehicles')
    .select(VEHICLE_SELECT)
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    console.error('[admin repo] getBySlug error:', error);
    return null;
  }
  if (!data) return null;
  await hydrateImages(supabase, [data]);
  return rowToVehicle(data);
}
