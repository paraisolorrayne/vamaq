import Link from "next/link";
import heroPhoto from "@/resources/foto-destaque.jpg";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import BrandBar from "@/components/BrandBar";
import StatsSection from "@/components/StatsSection";
import VehicleCard from "@/components/VehicleCard";
import ProcessSection from "@/components/ProcessSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import FAQ from "@/components/FAQ";
import { getFeaturedVehicles, getWhatsAppGenericUrl } from "@/data/vehicles";
import styles from "./page.module.css";

export default function HomePage() {
  const featuredVehicles = getFeaturedVehicles(6);

  return (
    <>
      <Header />
      <main id="main-content">
        {/* ======== HERO ======== */}
        <section className={styles.hero}>
          <div className="container">
            <div className={styles.heroContent}>
              <span className={styles.heroEyebrow}>Boutique Automotiva Premium</span>
              <h1 className={styles.heroTagline}>
                Dirija o <span className={styles.heroAccent}>extraordinário</span>
                <br />
                sem complicações
              </h1>
              <p className={styles.heroSubtitle}>
                Curadoria rigorosa, procedência garantida e os esportivos e superesportivos
                mais desejados do mercado — tudo em um só lugar.
              </p>
              <div className={styles.heroActions}>
                <Link href="/acervo" className="btn btn--primary btn--lg">
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
            <div className={styles.heroVisual}>
              <div className={styles.heroVisualCorner}>
                <span className={styles.heroVisualCornerDot} />
                Acervo selecionado
              </div>
              <img
                src={heroPhoto.src}
                width={heroPhoto.width}
                height={heroPhoto.height}
                alt="Mateus Parreira no showroom da Vamaq Motors com Ferrari SF90 e Lamborghini Huracán"
                className={styles.heroVisualImg}
                loading="eager"
              />
            </div>
          </div>
        </section>

        {/* ======== BRAND BAR ======== */}
        <BrandBar />

        {/* ======== STATS ======== */}
        <StatsSection />

        {/* ======== FEATURED VEHICLES ======== */}
        <section className="section section--bg">
          <div className="container">
            <div className="section__header">
              <h2 className="section__title">Acervo Selecionado</h2>
              <p className="section__subtitle">
                Cada veículo passa pela nossa curadoria rigorosa
              </p>
            </div>
            <div className={styles.vehiclesGrid}>
              {featuredVehicles.map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </div>
            <div className={styles.vehiclesMore}>
              <Link href="/acervo" className="btn btn--outline">
                Ver Acervo Completo →
              </Link>
            </div>
          </div>
        </section>

        {/* ======== ABOUT PREVIEW ======== */}
        <section className="section">
          <div className="container">
            <div className={styles.aboutPreview}>
              <div className={styles.aboutContent}>
                <h2 className={styles.aboutTitle}>Sobre a Vamaq Motors</h2>
                <p className={styles.aboutText}>
                  Liderada por Mateus Parreira, com mais de 13 anos de
                  experiência no mercado automotivo de luxo, a Vamaq Motors é
                  uma boutique focada exclusivamente em veículos premium,
                  esportivos e superesportivos. Cada carro do nosso portfolio
                  passa por uma curadoria rigorosa para garantir procedência
                  impecável e altíssimo padrão.
                </p>
                <Link href="/sobre" className="btn btn--primary">
                  Conheça Nossa História →
                </Link>
              </div>
              <div className={styles.aboutImage}>
                {/* SUBSTITUIR: foto real da loja ou do Mateus */}
                Foto Institucional
              </div>
            </div>
          </div>
        </section>

        {/* ======== PROCESS ======== */}
        <ProcessSection />

        {/* ======== TESTIMONIALS ======== */}
        <TestimonialsSection />

        {/* ======== FAQ ======== */}
        <FAQ />

        {/* ======== CTA FINAL ======== */}
        <section className="section section--dark">
          <div className="container" style={{ textAlign: "center" }}>
            <div className={styles.ctaSection}>
              <h2 className={styles.ctaTitle}>Pronto para o próximo nível?</h2>
              <p className={styles.ctaSubtitle}>
                Fale com um especialista e encontre o carro dos seus sonhos
              </p>
              <a
                href={getWhatsAppGenericUrl(
                  "Olá! Vi o site da Vamaq Motors e gostaria de falar com um especialista."
                )}
                className="btn btn--dark btn--lg"
                target="_blank"
                rel="noopener noreferrer"
              >
                Falar no WhatsApp →
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
