import Link from 'next/link';
import styles from './VehicleCard.module.css';

function formatKm(km) {
  return km.toLocaleString('pt-BR');
}

function formatPrice(price) {
  return price.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

export default function VehicleCard({ vehicle }) {
  return (
    <article className={styles.card}>
      <Link
        href={`/veiculo/${vehicle.slug}`}
        className={styles.imageWrap}
        aria-label={`Ver detalhes: ${vehicle.brand} ${vehicle.model}`}
      >
        {vehicle.badge && (
          <span className={styles.badge}>
            {vehicle.badge.toUpperCase()}
          </span>
        )}

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
      </Link>

      <div className={styles.body}>
        <Link href={`/veiculo/${vehicle.slug}`} className={styles.titleLink}>
          <span className={styles.brand}>{vehicle.brand.toUpperCase()}</span>
          <h3 className={styles.model}>{vehicle.model.toUpperCase()}</h3>
        </Link>

        <div className={styles.divider} />

        <p className={styles.meta}>
          <span>{vehicle.year}</span>
          <span className={styles.metaSpacer} />
          <span>{formatKm(vehicle.mileage)}km</span>
        </p>

        {vehicle.price ? (
          <p className={styles.price}>{formatPrice(vehicle.price)}</p>
        ) : (
          <p className={styles.priceConsult}>Sob Consulta</p>
        )}
      </div>
    </article>
  );
}
