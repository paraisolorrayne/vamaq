import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminGetVehicleById } from '@/lib/repositories/vehiclesAdmin';
import VehicleForm from '../../VehicleForm';
import VehicleImageManager from '../../VehicleImageManager';
import styles from '../../../../admin.module.css';

export const dynamic = 'force-dynamic';

export default async function EditarVeiculoPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const justCreated = sp?.created === '1';

  const vehicle = await adminGetVehicleById(id);
  if (!vehicle) notFound();

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            {vehicle.brand} {vehicle.model} <span style={{ color: 'var(--text-tertiary)' }}>· {vehicle.year}</span>
          </h1>
          <p className={styles.pageSubtitle}>
            Slug: <code>{vehicle.slug}</code> · Status atual: <strong>{vehicle.status}</strong>
          </p>
        </div>
        <div className={styles.actionBar}>
          <Link href={`/admin/preview/${vehicle.slug}`} target="_blank" rel="noopener" className={styles.btnOutline}>
            👁 Preview
          </Link>
          <Link href="/admin/veiculos" className={styles.btnOutline}>← Voltar</Link>
        </div>
      </div>

      <VehicleForm vehicle={vehicle} justCreated={justCreated} />

      <VehicleImageManager vehicleId={vehicle.id} images={vehicle.imageRows} />
    </>
  );
}
