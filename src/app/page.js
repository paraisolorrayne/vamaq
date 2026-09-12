import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import VehicleCard from "@/components/VehicleCard";
import { getFeaturedVehicles, getAllVehicles } from "@/lib/repositories/vehicles";
import { getWhatsAppGenericUrl } from "@/lib/whatsapp";
import { anoVeiculo } from "@/lib/anoVeiculo";
import styles from "./page.module.css";

// Render dinâmico: o hero/vitrine lê o estoque direto do Postgres, então o
// cache estático não enxerga alterações feitas no admin. Ver /acervo.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Vamaq Motors — Curadoria de carros especiais",
  description:
    "Acervo de veículos premium, esportivos e modelos especiais com curadoria, procedência e atendimento especializado.",
};

function formatPrice(vehicle) {
  return vehicle?.price
    ? vehicle.price.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
      })
    : "Sob consulta";
}

function formatKm(vehicle) {
  return vehicle?.mileage
    ? `${vehicle.mileage.toLocaleString("pt-BR")} km`
    : "0 km";
}

function heroFacts(vehicle) {
  return [
    anoVeiculo(vehicle),
    formatKm(vehicle),
    vehicle.fuel,
    vehicle.transmission,
  ].filter(Boolean);
}

function vehicleDifferentials(vehicle) {
  return [
    vehicle?.blindagem?.blindado ? "Blindado" : null,
    vehicle?.power,
    vehicle?.bodyType,
    vehicle?.badge && vehicle.badge !== "Destaque" ? vehicle.badge : null,
  ]
    .filter(Boolean)
    .slice(0, 2);
}

export default async function HomePage() {
  const [featuredVehicles, allVehicles] = await Promise.all([
    getFeaturedVehicles(4),
    getAllVehicles(),
  ]);
  const heroVehicle = featuredVehicles[0] || allVehicles[0] || null;
  const heroId = heroVehicle?.id;
  const editorialVehicles = [
    ...featuredVehicles.filter((v) => v.id !== heroId),
    ...allVehicles.filter((v) => v.id !== heroId),
  ].slice(0, 4);
  const narrativeVehicle = editorialVehicles[0] || heroVehicle;

  return (
    <>
      <Header />
      <main id="main-content">
        <section className={styles.hero}>
          {heroVehicle ? (
            <>
              <div className={styles.heroPhoto} aria-hidden="true">
                {heroVehicle.images?.main && (
                  <Image
                    src={heroVehicle.images.main}
                    alt=""
                    className={styles.heroImage}
                    fill
                    sizes="100vw"
                    preload
                    loading="eager"
                    fetchPriority="high"
                  />
                )}
              </div>

              <div className={styles.heroShade} />

              <div className={styles.heroInner}>
                <div className={`${styles.heroCopy} revela-entrada`}>
                  <p className={styles.heroKicker}>Vamaq Motors</p>
                  <p className={styles.heroContext}>Destaque do acervo</p>
                  <p className={styles.heroBrand}>{heroVehicle.brand}</p>
                  <h1 className={styles.heroModel}>{heroVehicle.model}</h1>

                  <div className={styles.heroFacts} aria-label="Informações principais">
                    {heroFacts(heroVehicle).map((fact) => (
                      <span key={fact}>{fact}</span>
                    ))}
                  </div>

                  {vehicleDifferentials(heroVehicle).length > 0 && (
                    <p className={styles.heroDifferentials}>
                      {vehicleDifferentials(heroVehicle).join(" · ")}
                    </p>
                  )}

                  <div className={styles.heroActions}>
                    <Link
                      href={`/veiculo/${heroVehicle.slug}`}
                      className={styles.heroPrimary}
                    >
                      Conhecer este veículo
                    </Link>
                    <Link href="/acervo" className={styles.heroSecondary}>
                      Explorar acervo
                    </Link>
                  </div>
                </div>

                <div className={`${styles.heroPanel} revela-entrada-2`}>
                  <span className={styles.heroPanelIndex}>01 / 04</span>
                  <span>Curadoria real</span>
                  <strong>{formatPrice(heroVehicle)}</strong>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.heroInner}>
              <div className={`${styles.heroEmpty} revela-entrada`}>
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
            </div>
          )}
        </section>

        {narrativeVehicle && (
          <section className={styles.story}>
            <div className={styles.storyMedia}>
              {narrativeVehicle.images?.main && (
                <Image
                  src={narrativeVehicle.images.main}
                  alt={`${narrativeVehicle.brand} ${narrativeVehicle.model}`}
                  className={styles.storyImage}
                  fill
                  sizes="(max-width: 900px) 100vw, 58vw"
                  loading="lazy"
                />
              )}
            </div>
            <div className={`${styles.storyCopy} revela`}>
              <p>Não vendemos apenas carros.</p>
              <p>Selecionamos aquilo que merece estar aqui.</p>
              <h2>Procedência. Curadoria. Performance.</h2>
            </div>
          </section>
        )}

        {editorialVehicles.length > 0 && (
          <section className={styles.editorial}>
            <div className={styles.sectionHead}>
              <span>Acervo selecionado</span>
              <h2>Carros escolhidos para provocar decisão, não apenas navegação.</h2>
              <Link href="/acervo">Ver todos</Link>
            </div>

            <div className={`${styles.editorialGrid} revela-grupo`}>
              {editorialVehicles.map((vehicle, index) => (
                <article
                  key={vehicle.id}
                  className={`${styles.editorialCard} ${index === 0 ? styles.editorialCardLead : ""}`}
                >
                  <Link
                    href={`/veiculo/${vehicle.slug}`}
                    className={styles.editorialImageWrap}
                    aria-label={`Ver ${vehicle.brand} ${vehicle.model}`}
                  >
                    {vehicle.images?.main && (
                      <Image
                        src={vehicle.images.main}
                        alt={`${vehicle.brand} ${vehicle.model} ${anoVeiculo(vehicle)}`}
                        className={styles.editorialImage}
                        fill
                        sizes={index === 0 ? "(max-width: 900px) 100vw, 58vw" : "(max-width: 900px) 100vw, 28vw"}
                        loading="lazy"
                      />
                    )}
                  </Link>
                  <div className={styles.editorialInfo}>
                    <span>{vehicle.brand}</span>
                    <h3>{vehicle.model}</h3>
                    <p>
                      {anoVeiculo(vehicle)} · {formatKm(vehicle)} · {formatPrice(vehicle)}
                    </p>
                    {vehicle.blindagem?.blindado && <strong>Blindado</strong>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className={styles.curadoria}>
          <div className={styles.curadoriaInner}>
            <div className={`${styles.curadoriaCopy} revela`}>
              <span>Curadoria Vamaq</span>
              <h2>Cada veículo entra no acervo por um motivo.</h2>
              <p>
                Liderada por Mateus Parreira, com mais de 13 anos de experiência
                no mercado automotivo de luxo. Curadoria rigorosa, procedência
                garantida e os esportivos mais desejados do mercado.
              </p>
              <Link href="/sobre">Conheça a Vamaq</Link>
            </div>
            <div className={styles.curadoriaImage}>
                <Image
                  src="/images/equipe/mateus-showroom.webp"
                  alt="Showroom da Vamaq Motors"
                  className={styles.curadoriaImageImg}
                  fill
                  sizes="(max-width: 900px) 100vw, 50vw"
                  loading="lazy"
                />
            </div>
          </div>
        </section>

        {/* ======== CTA — Venda seu carro ======== */}
        <section className={`${styles.sellCta} revela`}>
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
