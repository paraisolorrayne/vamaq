'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createVehicleAction, updateVehicleAction } from './actions';
import styles from '../../admin.module.css';

const BODY_TYPES = ['Coupé', 'SUV', 'Sedan', 'Conversível', 'Hatch', 'Pickup'];
const FUELS = ['Gasolina', 'Flex', 'Diesel', 'Elétrico', 'Híbrido'];
const TRANSMISSIONS = ['Automático', 'Manual', 'Automatizado'];
const STATUS_OPTIONS = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'ready', label: 'Pronto (não publicado)' },
  { value: 'published', label: 'Publicado' },
  { value: 'sold', label: 'Vendido' },
  { value: 'archived', label: 'Arquivado' },
];
const BADGES = [
  { value: '', label: '— Nenhum —' },
  { value: 'Novo', label: 'Novo' },
  { value: 'Destaque', label: 'Destaque' },
  { value: 'Blindado', label: 'Blindado' },
];

export default function VehicleForm({ vehicle = null, justCreated = false }) {
  const isEdit = Boolean(vehicle?.id);
  const initialState = justCreated ? { success: 'Veículo criado. Continue editando ou publique.' } : {};

  const [state, formAction, pending] = useActionState(
    isEdit ? updateVehicleAction : createVehicleAction,
    initialState
  );

  return (
    <form action={formAction} className={styles.form}>
      {isEdit && <input type="hidden" name="id" value={vehicle.id} />}

      {state?.error && <p className={styles.formError}>{state.error}</p>}
      {state?.success && <p className={styles.formSuccess}>{state.success}</p>}

      <section className={styles.formSection}>
        <h2 className={styles.formSectionTitle}>Identificação</h2>
        <div className={styles.formGrid}>
          <Field label="Marca *" name="brand" defaultValue={vehicle?.brand} required />
          <Field label="Modelo *" name="model" defaultValue={vehicle?.model} required />
          <Field
            label="Ano *"
            name="year"
            type="number"
            min="1950"
            max="2035"
            defaultValue={vehicle?.year ?? new Date().getFullYear()}
            required
          />
          <Field label="Cor *" name="color" defaultValue={vehicle?.color} required />
          <Select label="Carroceria *" name="body_type" defaultValue={vehicle?.bodyType} required options={BODY_TYPES} />
          <Field
            label="Slug (URL)"
            name="slug"
            defaultValue={vehicle?.slug}
            placeholder="Auto se vazio"
          />
        </div>
      </section>

      <section className={styles.formSection}>
        <h2 className={styles.formSectionTitle}>Comercial</h2>
        <div className={styles.formGrid}>
          <Field
            label="Preço (R$)"
            name="price"
            placeholder="Vazio = Consulte"
            defaultValue={vehicle?.price ?? ''}
          />
          <Field
            label="Quilometragem *"
            name="mileage"
            type="number"
            min="0"
            defaultValue={vehicle?.mileage ?? 0}
            required
          />
          <Select
            label="Badge"
            name="badge"
            defaultValue={vehicle?.badge ?? ''}
            optionsRaw={BADGES}
          />
          <div className={styles.formField}>
            <label className={styles.formCheckbox}>
              <input
                type="checkbox"
                name="featured"
                defaultChecked={Boolean(vehicle?.featured)}
              />
              Destacar na home (Acervo Selecionado)
            </label>
          </div>
        </div>
      </section>

      <section className={styles.formSection}>
        <h2 className={styles.formSectionTitle}>Powertrain</h2>
        <div className={styles.formGrid}>
          <Select label="Combustível *" name="fuel" defaultValue={vehicle?.fuel} options={FUELS} required />
          <Select label="Câmbio *" name="transmission" defaultValue={vehicle?.transmission} options={TRANSMISSIONS} required />
          <Field label="Potência *" name="power" placeholder="Ex: 480 cv" defaultValue={vehicle?.power} required />
        </div>
      </section>

      <section className={styles.formSection}>
        <h2 className={styles.formSectionTitle}>Ficha técnica</h2>
        <div className={styles.formGrid}>
          <Field label="Motor" name="spec_engine" placeholder="Ex: 3.0 Biturbo Boxer" defaultValue={vehicle?.specs?.engine} />
          <Field label="Aceleração 0-100" name="spec_acceleration" placeholder="Ex: 3.4s" defaultValue={vehicle?.specs?.acceleration} />
          <Field label="Velocidade máxima" name="spec_top_speed" placeholder="Ex: 312 km/h" defaultValue={vehicle?.specs?.topSpeed} />
          <Field label="Portas" name="spec_doors" type="number" min="0" max="6" defaultValue={vehicle?.specs?.doors ?? ''} />
          <Field label="Assentos" name="spec_seats" type="number" min="1" max="9" defaultValue={vehicle?.specs?.seats ?? ''} />
        </div>
      </section>

      <section className={styles.formSection}>
        <h2 className={styles.formSectionTitle}>Descrição</h2>
        <div className={styles.formGrid}>
          <div className={`${styles.formField} ${styles.fullWidth}`}>
            <label className={styles.formLabel}>Texto da página de detalhe</label>
            <textarea
              name="description"
              className={styles.formTextarea}
              defaultValue={vehicle?.description}
              placeholder="Descritivo aprofundado do veículo (3 a 6 linhas)."
            />
          </div>
        </div>
      </section>

      <section className={styles.formSection}>
        <h2 className={styles.formSectionTitle}>Status</h2>
        <div className={styles.formGrid}>
          <Select
            label="Status"
            name="status"
            defaultValue={vehicle?.status || 'draft'}
            optionsRaw={STATUS_OPTIONS}
          />
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 8 }}>
          Apenas veículos com status <strong>Publicado</strong> aparecem no site público.
          Use <strong>Preview</strong> para conferir antes de publicar.
        </p>
      </section>

      <div className={styles.formFooter}>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/admin/veiculos" className={styles.btnOutline}>
            ← Voltar
          </Link>
          {isEdit && (
            <Link
              href={`/admin/preview/${vehicle.slug}`}
              target="_blank"
              rel="noopener"
              className={styles.btnOutline}
            >
              👁 Preview
            </Link>
          )}
        </div>
        <button type="submit" className={styles.btnPrimary} disabled={pending}>
          {pending ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar veículo'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, name, type = 'text', defaultValue, placeholder, required, min, max }) {
  return (
    <div className={styles.formField}>
      <label className={styles.formLabel} htmlFor={`f-${name}`}>{label}</label>
      <input
        id={`f-${name}`}
        type={type}
        name={name}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        required={required}
        min={min}
        max={max}
        className={styles.formInput}
      />
    </div>
  );
}

function Select({ label, name, defaultValue, options, optionsRaw, required }) {
  const opts = optionsRaw || options.map((o) => ({ value: o, label: o }));
  return (
    <div className={styles.formField}>
      <label className={styles.formLabel} htmlFor={`s-${name}`}>{label}</label>
      <select
        id={`s-${name}`}
        name={name}
        defaultValue={defaultValue ?? ''}
        required={required}
        className={styles.formSelect}
      >
        {!required && !optionsRaw && <option value="">— Selecione —</option>}
        {opts.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
