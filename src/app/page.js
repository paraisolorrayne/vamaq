import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import VehicleCard from "@/components/VehicleCard";
import { getFeaturedVehicles, getAllVehicles } from "@/lib/repositories/vehicles";
import { getWhatsAppGenericUrl } from "@/lib/whatsapp";
import styles from "./page.module.css";

export const revalidate = 60;

export default async function HomePage() {
  const [featuredVehicles, allVehicles] = await Promise.all([
    getFeaturedVehicles(1),
    getAllVehicles(),
  ]);
  const heroVehicle = featuredVehicles[0] || allVehicles[0] || null;
  const heroId = heroVehicle?.id;
  const gridVehicles = allVehicles.filter((v) => v.id !== heroId).slice(0, 3);

  return (
    <>
      <Header />
      <main id="main-content">
        {/* ======== HERO — Compact featured + 3 vehicles grid (pyramid) ======== */}
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            {heroVehicle ? (
              <>
                <div className={styles.heroText}>
                  <h6 className={styles.heroBrand}>{heroVehicle.brand}</h6>
                  <h1 className={styles.heroModel}>{heroVehicle.model}</h1>
                </div>

                <Link
                  href={`/veiculo/${heroVehicle.slug}`}
                  className={styles.heroImageWrap}
                  aria-label={`Ver ${heroVehicle.brand} ${heroVehicle.model}`}
                >
                  {heroVehicle.images?.main && (
                    <img
                      src={heroVehicle.images.main}
                      alt={`${heroVehicle.brand} ${heroVehicle.model} ${heroVehicle.year}`}
                      className={styles.heroImage}
                      loading="eager"
                    />
                  )}
                </Link>

                <div className={styles.heroSpecs}>
                  <div className={styles.heroSpec}>
                    <span className={styles.heroSpecLabel}>Ano</span>
                    <span className={styles.heroSpecValue}>{heroVehicle.year}</span>
                  </div>
                  <div className={styles.heroSpec}>
                    <span className={styles.heroSpecLabel}>Km</span>
                    <span className={styles.heroSpecValue}>
                      {heroVehicle.mileage
                        ? `${heroVehicle.mileage.toLocaleString("pt-BR")}km`
                        : "0km"}
                    </span>
                  </div>
                  <div className={styles.heroSpec}>
                    <span className={styles.heroSpecLabel}>Valor</span>
                    <span className={styles.heroSpecValue}>
                      {heroVehicle.price
                        ? heroVehicle.price.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                            minimumFractionDigits: 0,
                          })
                        : "Sob consulta"}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.heroEmpty}>
                <h6 className={styles.heroBrand}>Vamaq Motors</h6>
                <h1 className={styles.heroModel}>Boutique Automotiva</h1>
                <p className={styles.heroVersion}>
                  Esportivos e superesportivos com curadoria rigorosa
                </p>
                <div className={styles.heroEmptyActions}>
                  <Link href="/acervo" className="btn btn--accent btn--lg">
                    Ver Acervo
                  </Link>
                  <a
                    href={getWhatsAppGenericUrl(
                      "Olá! Vi o site da Vamaq Motors e gostaria de mais informações."
                    )}
                    className="btn btn--outline btn--lg"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Fale no WhatsApp
                  </a>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ======== VEHICLES GRID — 3 columns below hero ======== */}
        {gridVehicles.length > 0 && (
          <section className={styles.featured}>
            <div className="container">
              <div className={styles.featuredGrid}>
                {gridVehicles.map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ======== REFERÊNCIA / ABOUT ======== */}
        <section className={styles.reference}>
          <div className="container">
            <div className={styles.referenceGrid}>
              <div className={styles.referenceLeft}>
                <span className={styles.referenceEyebrow}>Viva o seu sucesso</span>
                <h2 className={styles.referenceTitle}>
                  Referência no mercado premium
                </h2>
              </div>
              <div className={styles.referenceRight}>
                <h6 className={styles.referenceCompany}>Vamaq Motors</h6>
                <p className={styles.referenceText}>
                  Liderada por Mateus Parreira, com mais de 13 anos de experiência
                  no mercado automotivo de luxo. Curadoria rigorosa, procedência
                  garantida e os esportivos mais desejados do mercado.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ======== SEE ALL BUTTON ======== */}
        {featuredVehicles.length > 0 && (
          <section className={styles.featuredMoreSection}>
            <div className="container">
              <Link href="/acervo" className={styles.featuredMoreBtn}>
                Conheça todos os veículos
              </Link>
            </div>
          </section>
        )}

        {/* ======== ABOUT / DESCUBRA ======== */}
        <section className={styles.discover}>
          <div className="container">
            <div className={styles.discoverCard}>
              <div className={styles.discoverImage}>
                <img
                  src="/images/equipe/mateus-showroom.png"
                  alt="Showroom da Vamaq Motors"
                  className={styles.discoverImageImg}
                />
              </div>
              <div className={styles.discoverContent}>
                <h2 className={styles.discoverTitle}>Conheça a Vamaq</h2>
                <p className={styles.discoverText}>
                  Boutique automotiva especializada em veículos premium,
                  esportivos e superesportivos. Cada carro passa por uma
                  curadoria rigorosa.
                </p>
                <Link href="/sobre" className={styles.discoverLink}>
                  Sobre nós
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ======== CTA — Venda seu carro ======== */}
        <section className={styles.sellCta}>
          <div className="container">
            <div className={styles.sellCtaInner}>
              <div className={styles.sellCtaText}>
                <span className={styles.sellCtaEyebrow}>Fale com um especialista</span>
                <h2 className={styles.sellCtaTitle}>
                  Pronto para o próximo nível?
                </h2>
              </div>
              <a
                href={getWhatsAppGenericUrl(
                  "Olá! Vi o site da Vamaq Motors e gostaria de falar com um especialista."
                )}
                className={styles.sellCtaBtn}
                target="_blank"
                rel="noopener noreferrer"
              >
                Fale no WhatsApp →
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
