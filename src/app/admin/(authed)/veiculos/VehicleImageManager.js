'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';
import {
  uploadImagesAction,
  deleteImageAction,
  setPrimaryImageAction,
  reorderImagesAction,
} from './imageActions';
import styles from '../../admin.module.css';

export default function VehicleImageManager({ vehicleId, images = [] }) {
  const fileRef = useRef(null);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(null);

  // Estado local para D&D otimista. Mantém sincronizado com props quando o
  // server revalida.
  const [items, setItems] = useState(() => images);
  useEffect(() => setItems(images), [images]);

  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  /* ---------------------- Upload ---------------------- */

  const handleUpload = (e) => {
    e.preventDefault();
    const files = fileRef.current?.files;
    if (!files || !files.length) {
      setStatus({ error: 'Selecione ao menos um arquivo.' });
      return;
    }
    const fd = new FormData();
    fd.set('vehicleId', vehicleId);
    for (const f of files) fd.append('files', f);

    startTransition(async () => {
      const res = await uploadImagesAction(fd);
      setStatus(res || null);
      if (fileRef.current) fileRef.current.value = '';
    });
  };

  /* ---------------------- Delete ---------------------- */

  const handleDelete = (imageId, label) => {
    if (!window.confirm(`Remover esta imagem (${label})?`)) return;
    setItems((curr) => curr.filter((i) => i.id !== imageId));
    const fd = new FormData();
    fd.set('imageId', imageId);
    fd.set('vehicleId', vehicleId);
    startTransition(async () => {
      await deleteImageAction(fd);
    });
  };

  /* -------------------- Set primary -------------------- */

  const handleSetPrimary = (imageId) => {
    setItems((curr) =>
      curr.map((i) => ({ ...i, is_primary: i.id === imageId }))
    );
    const fd = new FormData();
    fd.set('imageId', imageId);
    fd.set('vehicleId', vehicleId);
    startTransition(async () => {
      await setPrimaryImageAction(fd);
    });
  };

  /* ------------------- Drag & Drop --------------------- */

  const onDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Necessário no Firefox
    try { e.dataTransfer.setData('text/plain', id); } catch {}
  };

  const onDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== overId) setOverId(id);
  };

  const onDragLeave = () => {
    setOverId(null);
  };

  const onDrop = (e, targetId) => {
    e.preventDefault();
    setOverId(null);
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }

    const fromIdx = items.findIndex((i) => i.id === dragId);
    const toIdx = items.findIndex((i) => i.id === targetId);
    if (fromIdx < 0 || toIdx < 0) {
      setDragId(null);
      return;
    }

    const next = [...items];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setItems(next);
    setDragId(null);
    persistOrder(next);
  };

  const onDragEnd = () => {
    setDragId(null);
    setOverId(null);
  };

  const move = (id, direction) => {
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= items.length) return;
    const next = [...items];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setItems(next);
    persistOrder(next);
  };

  const persistOrder = (list) => {
    const order = list.map((i) => i.id);
    startTransition(async () => {
      const res = await reorderImagesAction({ vehicleId, order });
      if (res?.error) {
        setStatus({ error: res.error });
        setItems(images); // rollback otimista
      }
    });
  };

  /* ------------------ Public URL hint ------------------ */

  const supabase = getBrowserSupabase();
  const previewUrl = (img) => {
    if (img.processed_url) return img.processed_url;
    if (supabase && img.processed_path) {
      const { data } = supabase.storage.from('processed').getPublicUrl(img.processed_path);
      return data?.publicUrl;
    }
    return null;
  };

  return (
    <section className={styles.form}>
      <h2 className={styles.formSectionTitle}>Imagens</h2>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0 0 8px' }}>
        Arraste para reordenar (ou use ← →). A imagem marcada como <strong>Principal</strong> vira a capa
        do card no acervo e a primeira da galeria, independente da posição na grade.
      </p>

      <form onSubmit={handleUpload} className={styles.uploadRow}>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className={styles.formInput}
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit" disabled={pending} className={styles.btnPrimary}>
          {pending ? 'Enviando…' : 'Enviar imagens'}
        </button>
      </form>

      {status?.error && <p className={styles.formError} style={{ marginTop: 12 }}>{status.error}</p>}
      {status?.success && <p className={styles.formSuccess} style={{ marginTop: 12 }}>{status.success}</p>}

      {items.length === 0 ? (
        <div className={styles.imageEmpty}>
          Nenhuma imagem enviada ainda. Faça upload para liberar o preview no site.
        </div>
      ) : (
        <div
          className={styles.imageGrid}
          onDragLeave={onDragLeave}
        >
          {items.map((img, idx) => {
            const url = previewUrl(img);
            const isDragging = dragId === img.id;
            const isOver = overId === img.id && dragId && dragId !== img.id;
            return (
              <div
                key={img.id}
                className={styles.imageItem}
                draggable
                onDragStart={(e) => onDragStart(e, img.id)}
                onDragOver={(e) => onDragOver(e, img.id)}
                onDrop={(e) => onDrop(e, img.id)}
                onDragEnd={onDragEnd}
                style={{
                  cursor: 'grab',
                  opacity: isDragging ? 0.4 : 1,
                  outline: isOver ? '2px solid var(--color-accent)' : 'none',
                  outlineOffset: isOver ? 2 : 0,
                  transition: 'outline 0.1s ease',
                }}
                aria-grabbed={isDragging || undefined}
                aria-label={`Imagem na posição ${idx + 1}`}
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="" draggable={false} />
                ) : (
                  <div style={{ padding: 12, fontSize: 12 }}>(sem preview)</div>
                )}

                {img.is_primary && <span className={styles.imageBadge}>Principal</span>}

                <span
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 100,
                    fontWeight: 600,
                  }}
                >
                  #{idx + 1}
                </span>

                <div className={styles.imageActions}>
                  <button
                    type="button"
                    onClick={() => move(img.id, 'up')}
                    disabled={pending || idx === 0}
                    aria-label="Mover para esquerda"
                    title="Mover ←"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => move(img.id, 'down')}
                    disabled={pending || idx === items.length - 1}
                    aria-label="Mover para direita"
                    title="Mover →"
                  >
                    →
                  </button>
                  {!img.is_primary && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(img.id)}
                      disabled={pending}
                    >
                      ★
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(img.id, img.processed_path)}
                    disabled={pending}
                    style={{ color: '#b91c1c' }}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
