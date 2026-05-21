'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { publishAction, unpublishAction } from './actions';
import ConfirmDeleteButton from './ConfirmDeleteButton';
import styles from '../../admin.module.css';

const STATUS_LABEL = {
  draft: 'Rascunho',
  processing: 'Processando',
  ready: 'Pronto',
  published: 'Publicado',
  sold: 'Vendido',
  archived: 'Arquivado',
};

const STATUS_CLASS = {
  draft: styles.statusDraft,
  processing: styles.statusDraft,
  ready: styles.statusReady,
  published: styles.statusPublished,
  sold: styles.statusSold,
  archived: styles.statusArchived,
};

const FILTER_TABS = [
  { value: 'all', label: 'Todos' },
  { value: 'published', label: 'Publicados' },
  { value: 'ready', label: 'Prontos' },
  { value: 'draft', label: 'Rascunhos' },
  { value: 'sold', label: 'Vendidos' },
  { value: 'archived', label: 'Arquivados' },
];

export default function VeiculosListClient({ vehicles }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [onlyFeatured, setOnlyFeatured] = useState(false);

  const counts = useMemo(() => {
    const map = { all: vehicles.length };
    for (const v of vehicles) {
      map[v.status] = (map[v.status] || 0) + 1;
    }
    return map;
  }, [vehicles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      if (onlyFeatured && !v.featured) return false;
      if (q) {
        const hay = `${v.brand} ${v.model} ${v.color} ${v.year}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [vehicles, search, statusFilter, onlyFeatured]);

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Veículos</h1>
          <p className={styles.pageSubtitle}>
            Mostrando {filtered.length} de {vehicles.length}.
          </p>
        </div>
        <div className={styles.actionBar}>
          <Link href="/admin/veiculos/novo" className={styles.btnPrimary}>
            + Novo veículo
          </Link>
        </div>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 18,
          alignItems: 'center',
        }}
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar marca, modelo, cor…"
          className={styles.formInput}
          style={{ flex: '1 1 260px', maxWidth: 360, height: 40 }}
          aria-label="Buscar veículos"
        />

        <div
          role="tablist"
          aria-label="Filtrar por status"
          style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
        >
          {FILTER_TABS.map((tab) => {
            const active = statusFilter === tab.value;
            const count = counts[tab.value] || 0;
            return (
              <button
                key={tab.value}
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(tab.value)}
                className={styles.rowAction}
                style={{
                  height: 40,
                  background: active ? 'var(--text-primary)' : 'var(--bg-primary)',
                  color: active ? 'white' : 'var(--text-primary)',
                  borderColor: active ? 'var(--text-primary)' : 'var(--border-light)',
                }}
              >
                {tab.label}
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    background: active ? 'rgba(255,255,255,0.18)' : 'var(--bg-tertiary)',
                    padding: '2px 7px',
                    borderRadius: 100,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            marginLeft: 'auto',
          }}
        >
          <input
            type="checkbox"
            checked={onlyFeatured}
            onChange={(e) => setOnlyFeatured(e.target.checked)}
          />
          Só destaque
        </label>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <strong>Nenhum veículo encontrado</strong>
          {search || statusFilter !== 'all' || onlyFeatured
            ? 'Ajuste a busca ou os filtros acima.'
            : 'Comece criando o primeiro registro.'}
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: 88 }}>Foto</th>
              <th>Veículo</th>
              <th>Status</th>
              <th>Destaque</th>
              <th>Atualizado</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => (
              <tr key={v.id}>
                <td>
                  {v.images.main ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={styles.thumb} src={v.images.main} alt="" />
                  ) : (
                    <div className={styles.thumbPlaceholder}>SEM FOTO</div>
                  )}
                </td>
                <td>
                  <strong>{v.brand} {v.model}</strong>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
                    {v.year} · {v.color} · {v.mileage.toLocaleString('pt-BR')} km
                  </div>
                </td>
                <td>
                  <span className={`${styles.statusPill} ${STATUS_CLASS[v.status] || ''}`}>
                    {STATUS_LABEL[v.status] || v.status}
                  </span>
                </td>
                <td>{v.featured ? 'Sim' : '—'}</td>
                <td style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
                  {new Date(v.updatedAt).toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </td>
                <td>
                  <div className={styles.rowActions}>
                    <Link
                      href={`/admin/preview/${v.slug}`}
                      className={styles.rowAction}
                      target="_blank"
                      rel="noopener"
                    >
                      Preview
                    </Link>
                    <Link
                      href={`/admin/veiculos/${v.id}/editar`}
                      className={styles.rowAction}
                    >
                      Editar
                    </Link>
                    {v.status === 'published' ? (
                      <form action={unpublishAction} style={{ display: 'inline' }}>
                        <input type="hidden" name="id" value={v.id} />
                        <button type="submit" className={styles.rowAction}>
                          Despublicar
                        </button>
                      </form>
                    ) : (
                      <form action={publishAction} style={{ display: 'inline' }}>
                        <input type="hidden" name="id" value={v.id} />
                        <button
                          type="submit"
                          className={`${styles.rowAction} ${styles.rowActionPrimary}`}
                        >
                          Publicar
                        </button>
                      </form>
                    )}
                    <ConfirmDeleteButton
                      vehicleId={v.id}
                      label={`${v.brand} ${v.model}`}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
