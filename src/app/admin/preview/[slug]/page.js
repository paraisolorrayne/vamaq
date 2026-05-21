import Link from 'next/link';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import VehicleDetailView from '@/components/VehicleDetailView';
import { adminGetVehicleBySlug } from '@/lib/repositories/vehiclesAdmin';
import { publishAction } from '@/app/admin/(authed)/veiculos/actions';
import styles from '@/app/admin/admin.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Preview — Admin Vamaq',
  robots: { index: false, follow: false },
};

const STATUS_LABEL = {
  draft: 'Rascunho',
  ready: 'Pronto',
  published: 'Publicado',
  sold: 'Vendido',
  archived: 'Arquivado',
  processing: 'Processando',
};

export default async function PreviewPage({ params }) {
  const { slug } = await params;
  const vehicle = await adminGetVehicleBySlug(slug);
  if (!vehicle) notFound();

  const isPublished = vehicle.status === 'published';
  const hasImages = (vehicle.images?.gallery?.length || 0) > 0;

  return (
    <>
      <div className={styles.previewBanner}>
        <div className={styles.previewBannerInfo}>
          <span className={styles.previewBannerTag}>PREVIEW</span>
          <span>
            Status atual: <strong>{STATUS_LABEL[vehicle.status] || vehicle.status}</strong>
            {!hasImages && ' · ⚠ sem imagens'}
            {' · '}
            assim que o cliente vai ver depois de publicado.
          </span>
        </div>
        <div className={styles.previewBannerActions}>
          <Link
            href={`/admin/veiculos/${vehicle.id}/editar`}
            className="outlined"
          >
            ← Voltar editar
          </Link>
          {!isPublished ? (
            <form action={publishAction}>
              <input type="hidden" name="id" value={vehicle.id} />
              <button type="submit">Publicar agora</button>
            </form>
          ) : (
            <Link href={`/veiculo/${vehicle.slug}`} target="_blank" rel="noopener">
              Abrir página pública ↗
            </Link>
          )}
        </div>
      </div>

      <Header />
      <VehicleDetailView vehicle={vehicle} related={[]} isPreview />
      <Footer />
    </>
  );
}
