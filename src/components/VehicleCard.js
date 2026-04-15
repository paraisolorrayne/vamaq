import Link from 'next/link';
import { getWhatsAppUrl } from '@/data/vehicles';
import styles from './VehicleCard.module.css';

function formatKm(km) {
  return km.toLocaleString('pt-BR');
}

function getBadgeClass(badge) {
  if (!badge) return '';
  const map = {
    'Novo': styles.badgeNew,
    'Destaque': styles.badgeFeatured,
    'Blindado': styles.badgeArmored,
  };
  return map[badge] || styles.badgeNew;
}

export default function VehicleCard({ vehicle }) {
  const whatsappUrl = getWhatsAppUrl(vehicle);

  return (
    <article className={styles.card}>
      <Link
        href={`/veiculo/${vehicle.slug}`}
        className={styles.imageWrap}
        aria-label={`Ver detalhes: ${vehicle.brand} ${vehicle.model}`}
      >
        <div className={styles.placeholder}>
          <svg
            className={styles.placeholderIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </div>

        {vehicle.badge && (
          <span className={`${styles.badge} ${getBadgeClass(vehicle.badge)}`}>
            {vehicle.badge}
          </span>
        )}
      </Link>

      <div className={styles.body}>
        <Link href={`/veiculo/${vehicle.slug}`}>
          <h3 className={styles.title}>
            {vehicle.brand} {vehicle.model}
          </h3>
        </Link>

        <p className={styles.meta}>
          {vehicle.year} &middot; {formatKm(vehicle.mileage)} km
        </p>

        <div className={styles.specs}>
          <span className={styles.spec}>
            <svg className={styles.specIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 22V12a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10M15 22V8a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14M9 22v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6" />
            </svg>
            {vehicle.fuel}
          </span>

          <span className={styles.spec}>
            <svg className={styles.specIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            {vehicle.transmission}
          </span>

          <span className={styles.spec}>
            <svg className={styles.specIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            {vehicle.power}
          </span>
        </div>

        <div className={styles.priceRow}>
          {vehicle.price ? (
            <p className={styles.price}>
              {vehicle.price.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: 0,
              })}
            </p>
          ) : (
            <p className={styles.priceConsult}>Consulte</p>
          )}

          <a
            href={whatsappUrl}
            className={styles.cta}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Tenho interesse no ${vehicle.brand} ${vehicle.model} - abrir WhatsApp`}
          >
            Tenho Interesse →
          </a>
        </div>
      </div>
    </article>
  );
}
