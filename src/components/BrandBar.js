import styles from './BrandBar.module.css';

const BRANDS = [
  'PORSCHE',
  'BMW',
  'MERCEDES-BENZ',
  'AUDI',
  'FERRARI',
  'LAMBORGHINI',
  'McLAREN',
  'LAND ROVER',
  'BENTLEY',
  'MASERATI',
];

export default function BrandBar() {
  return (
    <section className={styles.section} aria-label="Marcas que trabalhamos">
      <div className={styles.track}>
        <div className={styles.list} aria-hidden="false">
          {BRANDS.map((brand) => (
            <span key={brand} className={styles.brand}>
              {brand}
            </span>
          ))}
        </div>
        <div className={styles.list} aria-hidden="true">
          {BRANDS.map((brand) => (
            <span key={`dup-${brand}`} className={styles.brand}>
              {brand}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
