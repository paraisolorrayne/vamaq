import { notFound } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import VehicleCard from "@/components/VehicleCard";
import VehicleGallery from "@/components/VehicleGallery";
import {
  vehicles,
  getVehicleBySlug,
  getRelatedVehicles,
  getWhatsAppUrl,
} from "@/data/vehicles";
import styles from "./veiculo.module.css";

function resolveGalleryImages(vehicle) {
  const images = vehicle?.images;
  if (!images) return [];
  if (Array.isArray(images)) return images.filter(Boolean);
  const list = [];
  if (images.main) list.push(images.main);
  if (Array.isArray(images.gallery)) list.push(...images.gallery.filter(Boolean));
  return list;
}

export function generateStaticParams() {
  return vehicles.map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const vehicle = getVehicleBySlug(slug);
  if (!vehicle) return {};
  return {
    title: `${vehicle.brand} ${vehicle.model} ${vehicle.year}`,
    description: vehicle.description,
    openGraph: {
      title: `${vehicle.brand} ${vehicle.model} ${vehicle.year} — Vamaq Motors`,
      description: vehicle.description,
    },
  };
}

export default async function VeiculoPage({ params }) {
  const { slug } = await params;
  const vehicle = getVehicleBySlug(slug);
  if (!vehicle) notFound();

  const related = getRelatedVehicles(vehicle, 3);
  const whatsappUrl = getWhatsAppUrl(vehicle);
  const galleryImages = resolveGalleryImages(vehicle);

  const badgeMap = {
    Novo: "badge badge--new",
    Destaque: "badge badge--featured",
    Blindado: "badge badge--armored",
  };

  return (
    <>
      <Header />
      <main id="main-content" className={styles.page}>
        <div className="container">
          {/* Breadcrumb */}
          <nav className={styles.breadcrumb} aria-label="Navegação">
            <Link href="/">Início</Link>
            <span aria-hidden="true"> / </span>
            <Link href="/acervo">Acervo</Link>
            <span aria-hidden="true"> / </span>
            <span>
              {vehicle.brand} {vehicle.model}
            </span>
          </nav>

          {/* Hero */}
          <section className={styles.hero}>
            <VehicleGallery
              images={galleryImages}
              alt={`${vehicle.brand} ${vehicle.model} ${vehicle.year}`}
              badge={
                vehicle.badge ? (
                  <span className={badgeMap[vehicle.badge] || "badge badge--new"}>
                    {vehicle.badge}
                  </span>
                ) : null
              }
            />

            <div className={styles.heroInfo}>
              <div className={styles.brandEyebrow}>{vehicle.brand}</div>
              <h1 className={styles.title}>{vehicle.model}</h1>
              <div className={styles.heroMeta}>
                <span>{vehicle.year}</span>
                <span className={styles.dot} aria-hidden="true" />
                <span>{vehicle.quilometragem.toLocaleString("pt-BR")} km</span>
                <span className={styles.dot} aria-hidden="true" />
                <span>{vehicle.color}</span>
              </div>

              <div className={styles.priceCard}>
                <span className={styles.priceLabel}>Valor</span>
                {vehicle.price ? (
                  <div className={styles.price}>
                    R$ {vehicle.price.toLocaleString("pt-BR")}
                  </div>
                ) : (
                  <div className={`${styles.price} ${styles.priceConsult}`}>
                    Consulte o valor
                  </div>
                )}

                <div className={styles.actions}>
                  <a
                    href={whatsappUrl}
                    className={`btn btn--primary btn--lg ${styles.primaryCta}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <WhatsAppIcon />
                    Tenho Interesse
                  </a>
                  <a
                    href={whatsappUrl}
                    className={`btn btn--outline btn--lg ${styles.secondaryCta}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Agendar Visita
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* Specs grid */}
          <section className={styles.specsSection}>
            <h2 className={styles.sectionTitle}>Ficha Técnica</h2>
            <div className={styles.specs}>
              <SpecItem
                label="Quilometragem"
                value={`${vehicle.quilometragem.toLocaleString("pt-BR")} km`}
              />
              <SpecItem label="Combustível" value={vehicle.fuel} />
              <SpecItem label="Câmbio" value={vehicle.transmission} />
              <SpecItem label="Potência" value={vehicle.power} />
              <SpecItem label="Portas" value={vehicle.specs.doors} />
              <SpecItem label="Cor" value={vehicle.color} />
            </div>
          </section>

          {/* Description + performance highlights */}
          <section className={styles.descriptionSection}>
            <div className={styles.descriptionText}>
              <h2 className={styles.sectionTitle}>Sobre este veículo</h2>
              <p>{vehicle.description}</p>
            </div>

            {vehicle.specs.engine && (
              <aside className={styles.performanceCard}>
                <h3 className={styles.performanceTitle}>Performance</h3>
                <dl className={styles.performanceList}>
                  <div className={styles.performanceItem}>
                    <dt>Motor</dt>
                    <dd>{vehicle.specs.engine}</dd>
                  </div>
                  <div className={styles.performanceItem}>
                    <dt>0 a 100 km/h</dt>
                    <dd>{vehicle.specs.acceleration}</dd>
                  </div>
                  <div className={styles.performanceItem}>
                    <dt>Velocidade máxima</dt>
                    <dd>{vehicle.specs.topSpeed}</dd>
                  </div>
                </dl>
              </aside>
            )}
          </section>

          {/* Related */}
          {related.length > 0 && (
            <section className={styles.relatedSection}>
              <div className={styles.relatedHeader}>
                <h2 className={styles.sectionTitle}>Você também pode gostar</h2>
                <Link href="/acervo" className={styles.relatedLink}>
                  Ver acervo completo →
                </Link>
              </div>
              <div className={styles.relatedGrid}>
                {related.map((v) => (
                  <VehicleCard key={v.id} vehicle={v} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Mobile CTA bar */}
      <div className={styles.mobileCta}>
        <a
          href={whatsappUrl}
          className="btn btn--primary btn--lg btn--full"
          target="_blank"
          rel="noopener noreferrer"
        >
          <WhatsAppIcon />
          Tenho Interesse
        </a>
      </div>

      <Footer />
      <WhatsAppFloat />
    </>
  );
}

function SpecItem({ label, value }) {
  return (
    <div className={styles.specItem}>
      <div className={styles.specLabel}>{label}</div>
      <div className={styles.specValue}>{value}</div>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
