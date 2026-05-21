'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';

/* ----------------------------- helpers ----------------------------- */

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function parseIntOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function parseFloatOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v) {
  const s = String(v ?? '').trim();
  return s ? s : null;
}

function buildPayload(formData) {
  const brand = String(formData.get('brand') || '').trim();
  const model = String(formData.get('model') || '').trim();
  const year = parseIntOrNull(formData.get('year')) ?? new Date().getFullYear();
  const slugRaw = String(formData.get('slug') || '').trim();
  const slug = slugRaw ? slugify(slugRaw) : slugify(`${brand}-${model}-${year}`);

  return {
    slug,
    brand,
    model,
    year,
    body_type: String(formData.get('body_type') || '').trim(),
    color: String(formData.get('color') || '').trim(),
    price: parseFloatOrNull(formData.get('price')),
    mileage: parseIntOrNull(formData.get('mileage')) ?? 0,
    badge: strOrNull(formData.get('badge')),
    featured: formData.get('featured') === 'on',
    fuel: String(formData.get('fuel') || '').trim(),
    transmission: String(formData.get('transmission') || '').trim(),
    power: String(formData.get('power') || '').trim(),
    spec_engine: strOrNull(formData.get('spec_engine')),
    spec_acceleration: strOrNull(formData.get('spec_acceleration')),
    spec_top_speed: strOrNull(formData.get('spec_top_speed')),
    spec_doors: parseIntOrNull(formData.get('spec_doors')),
    spec_seats: parseIntOrNull(formData.get('spec_seats')),
    description: String(formData.get('description') || '').trim(),
    status: String(formData.get('status') || 'draft'),
  };
}

function validate(p) {
  const errors = [];
  if (!p.brand) errors.push('Marca obrigatória.');
  if (!p.model) errors.push('Modelo obrigatório.');
  if (!p.year || p.year < 1950 || p.year > 2035) errors.push('Ano inválido.');
  if (!p.body_type) errors.push('Tipo de carroceria obrigatório.');
  if (!p.color) errors.push('Cor obrigatória.');
  if (!p.fuel) errors.push('Combustível obrigatório.');
  if (!p.transmission) errors.push('Câmbio obrigatório.');
  if (!p.power) errors.push('Potência obrigatória.');
  if (p.mileage < 0) errors.push('Quilometragem não pode ser negativa.');
  return errors;
}

/* ----------------------------- actions ----------------------------- */

export async function createVehicleAction(_prevState, formData) {
  const supabase = await getServerSupabase();
  if (!supabase) return { error: 'Supabase não configurado.' };

  const payload = buildPayload(formData);
  const errors = validate(payload);
  if (errors.length) return { error: errors.join(' ') };

  const { data: { user } } = await supabase.auth.getUser();
  if (user) payload.created_by = user.id;

  const { data, error } = await supabase
    .from('vehicles')
    .insert(payload)
    .select('id, slug')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: 'Já existe um veículo com este slug. Edite o campo Slug.' };
    }
    return { error: error.message || 'Falha ao salvar.' };
  }

  revalidatePath('/admin/veiculos');
  revalidatePath('/acervo');
  redirect(`/admin/veiculos/${data.id}/editar?created=1`);
}

export async function updateVehicleAction(_prevState, formData) {
  const id = String(formData.get('id') || '');
  if (!id) return { error: 'ID ausente.' };

  const supabase = await getServerSupabase();
  if (!supabase) return { error: 'Supabase não configurado.' };

  const payload = buildPayload(formData);
  const errors = validate(payload);
  if (errors.length) return { error: errors.join(' ') };

  const { error } = await supabase
    .from('vehicles')
    .update(payload)
    .eq('id', id);

  if (error) {
    if (error.code === '23505') {
      return { error: 'Slug já está em uso por outro veículo.' };
    }
    return { error: error.message || 'Falha ao atualizar.' };
  }

  revalidatePath('/admin/veiculos');
  revalidatePath('/acervo');
  revalidatePath(`/veiculo/${payload.slug}`);
  return { success: 'Alterações salvas.' };
}

export async function publishAction(formData) {
  const id = String(formData.get('id') || '');
  if (!id) return;
  const supabase = await getServerSupabase();
  if (!supabase) return;

  await supabase
    .from('vehicles')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', id);

  revalidatePath('/admin/veiculos');
  revalidatePath('/acervo');
  revalidatePath('/');
}

export async function unpublishAction(formData) {
  const id = String(formData.get('id') || '');
  if (!id) return;
  const supabase = await getServerSupabase();
  if (!supabase) return;

  await supabase
    .from('vehicles')
    .update({ status: 'ready' })
    .eq('id', id);

  revalidatePath('/admin/veiculos');
  revalidatePath('/acervo');
  revalidatePath('/');
}

export async function deleteVehicleAction(formData) {
  const id = String(formData.get('id') || '');
  if (!id) return;
  const supabase = await getServerSupabase();
  if (!supabase) return;

  // Tenta deletar imagens do storage (best-effort)
  const { data: imgs } = await supabase
    .from('vehicle_images')
    .select('processed_path, original_path')
    .eq('vehicle_id', id);

  if (imgs?.length) {
    const processedPaths = imgs.map((i) => i.processed_path).filter(Boolean);
    const originalPaths = imgs.map((i) => i.original_path).filter(Boolean);
    if (processedPaths.length) {
      await supabase.storage.from('processed').remove(processedPaths);
    }
    if (originalPaths.length) {
      await supabase.storage.from('originals').remove(originalPaths);
    }
  }

  await supabase.from('vehicles').delete().eq('id', id);

  revalidatePath('/admin/veiculos');
  revalidatePath('/acervo');
  revalidatePath('/');
}
