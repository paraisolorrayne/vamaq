'use server';

import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';
import { getAdminSupabase } from '@/lib/supabase/admin';

/**
 * Faz upload das fotos enviadas no FormData direto no bucket `processed`
 * (publicação imediata, sem passar pelo job de tratamento da Fase 3).
 *
 * Cada arquivo vira uma linha em vehicle_images com processed_path preenchido
 * e processing_status = 'skipped'. A primeira imagem do veículo é marcada
 * como primária automaticamente.
 */
export async function uploadImagesAction(formData) {
  const vehicleId = String(formData.get('vehicleId') || '');
  if (!vehicleId) return { error: 'vehicleId ausente.' };

  const files = formData.getAll('files').filter((f) => f && typeof f === 'object' && f.size > 0);
  if (!files.length) return { error: 'Nenhum arquivo enviado.' };

  const supabase = await getServerSupabase();
  if (!supabase) return { error: 'Supabase não configurado.' };

  const { data: existing } = await supabase
    .from('vehicle_images')
    .select('id, position, is_primary')
    .eq('vehicle_id', vehicleId);

  const existingCount = existing?.length || 0;
  const hasPrimary = (existing || []).some((i) => i.is_primary);

  const uploaded = [];
  let position = existingCount;

  for (const file of files) {
    const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase();
    const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
    const path = `${vehicleId}/${Date.now()}-${position}.${safeExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from('processed')
      .upload(path, buffer, {
        contentType: file.type || `image/${safeExt}`,
        upsert: false,
      });

    if (upErr) {
      console.error('[upload] storage error:', upErr);
      return { error: `Falha no upload: ${upErr.message}` };
    }

    const isPrimary = !hasPrimary && uploaded.length === 0;
    const { error: rowErr } = await supabase
      .from('vehicle_images')
      .insert({
        vehicle_id: vehicleId,
        position,
        is_primary: isPrimary,
        original_path: path,
        processed_path: path,
        processing_status: 'skipped',
        original_bytes: file.size,
      });

    if (rowErr) {
      // Limpa o arquivo se a inserção da linha falhou
      await supabase.storage.from('processed').remove([path]);
      console.error('[upload] db error:', rowErr);
      return { error: `Falha ao registrar imagem: ${rowErr.message}` };
    }

    uploaded.push(path);
    position += 1;
  }

  revalidatePath('/admin/veiculos');
  revalidatePath(`/admin/veiculos/${vehicleId}/editar`);
  return { success: `${uploaded.length} imagem(ns) enviadas.` };
}

export async function deleteImageAction(formData) {
  const imageId = String(formData.get('imageId') || '');
  const vehicleId = String(formData.get('vehicleId') || '');
  if (!imageId) return;

  const supabase = await getServerSupabase();
  if (!supabase) return;

  const { data: row } = await supabase
    .from('vehicle_images')
    .select('processed_path, original_path, is_primary')
    .eq('id', imageId)
    .maybeSingle();

  if (row?.processed_path) {
    await supabase.storage.from('processed').remove([row.processed_path]);
  }
  if (row?.original_path && row.original_path !== row.processed_path) {
    await supabase.storage.from('originals').remove([row.original_path]);
  }

  await supabase.from('vehicle_images').delete().eq('id', imageId);

  // Se removeu a primária, promove a próxima
  if (row?.is_primary && vehicleId) {
    const { data: next } = await supabase
      .from('vehicle_images')
      .select('id')
      .eq('vehicle_id', vehicleId)
      .order('position')
      .limit(1)
      .maybeSingle();
    if (next?.id) {
      await supabase
        .from('vehicle_images')
        .update({ is_primary: true })
        .eq('id', next.id);
    }
  }

  revalidatePath('/admin/veiculos');
  if (vehicleId) revalidatePath(`/admin/veiculos/${vehicleId}/editar`);
}

export async function reorderImagesAction(payload) {
  const vehicleId = payload?.vehicleId;
  const order = Array.isArray(payload?.order) ? payload.order : [];
  if (!vehicleId || !order.length) return { error: 'Payload inválido.' };

  const supabase = await getServerSupabase();
  if (!supabase) return { error: 'Supabase não configurado.' };

  // Atualiza position em batch. Quantidade pequena (<= 20), updates sequenciais
  // são aceitáveis e mantêm a transação simples (sem precisar de RPC).
  for (let i = 0; i < order.length; i++) {
    const imageId = order[i];
    const { error } = await supabase
      .from('vehicle_images')
      .update({ position: i })
      .eq('id', imageId)
      .eq('vehicle_id', vehicleId);
    if (error) {
      console.error('[reorder] update error:', error);
      return { error: error.message || 'Falha ao reordenar.' };
    }
  }

  revalidatePath('/admin/veiculos');
  revalidatePath(`/admin/veiculos/${vehicleId}/editar`);
  return { success: 'Ordem atualizada.' };
}

export async function setPrimaryImageAction(formData) {
  const imageId = String(formData.get('imageId') || '');
  const vehicleId = String(formData.get('vehicleId') || '');
  if (!imageId || !vehicleId) return;

  // Service role para evitar choque com o unique index parcial durante o swap.
  const admin = getAdminSupabase();
  const supabase = admin || (await getServerSupabase());
  if (!supabase) return;

  await supabase
    .from('vehicle_images')
    .update({ is_primary: false })
    .eq('vehicle_id', vehicleId);

  await supabase
    .from('vehicle_images')
    .update({ is_primary: true })
    .eq('id', imageId);

  revalidatePath('/admin/veiculos');
  revalidatePath(`/admin/veiculos/${vehicleId}/editar`);
}
