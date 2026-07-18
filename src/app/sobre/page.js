import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import { getWhatsAppGenericUrl } from "@/lib/whatsapp";
import styles from "./sobre.module.css";

export const metadata = {
  title: "Sobre",
  description:
    "Vamaq Motors — 13 anos de mercado, mais de 2.500 veículos negociados. Curadoria automotiva com a assinatura de Mateus Parreira.",
};

export default function SobrePage() {
  return (
    <>
      <Header />
      <main id="main-content">
        {/* Hero */}
        <div className={`container ${styles.hero}`}>
          <h1 className={styles.heroTitle}>Sobre a Vamaq Motors</h1>
          <p className={styles.heroSubtitle}>
            13 anos de mercado. Mais de 2.500 veículos negociados. Uma única
            obsessão: procedência.
          </p>
        </div>

        {/* Content */}
        <section className="section">
          <div className="container">
            <div className={styles.content}>
              <div className={styles.text}>
                <h2 className={styles.heading}>A Vamaq nasceu da paixão pelo que faço</h2>
                <p>
                  A Vamaq Motors é a materialização de 13 anos de mercado.
                  Começou em 2014, com um vendedor que sempre fez questão de
                  unir três coisas que raramente andam juntas no setor
                  automotivo: seriedade, transparência e paixão real pelo
                  produto.
                </p>
                <p>
                  Sou o Mateus Parreira, administrador de marketing por
                  formação e vendedor por vocação. Já passaram pelas minhas
                  mãos mais de 2.500 veículos — de nacionais selecionadas a
                  importados de coleção. A Vamaq foi fundada em 2026, mas
                  carrega na essência uma trajetória inteira de relacionamento
                  e procedência impecável.
                </p>

                <h2 className={styles.heading}>O que me move</h2>
                <p>
                  Vender o que eu mais amo. Carro nunca foi mercadoria pra mim
                  — é projeto, é desejo, é decisão importante na vida de quem
                  compra. Por isso aqui não tem pressa, não tem pressão e não
                  tem letra miúda. O que tem é histórico, transparência e o
                  compromisso de só vender um carro que eu mesmo compraria.
                </p>

                <h2 className={styles.heading}>Como trabalhamos</h2>
                <p>
                  Cada carro que entra no nosso acervo passa por uma
                  verificação rigorosa de procedência, histórico de manutenção
                  e estado de conservação. Trabalhamos com o melhor do mercado
                  premium — Porsche, BMW, Mercedes-AMG, Audi, Range Rover,
                  Ferrari, Lamborghini, McLaren — e também com nacionais
                  selecionadas, desde que o carro tenha procedência e estado
                  para entrar na Vamaq.
                </p>
              </div>
              <div className={styles.imagePlaceholder}>
                <img
                  src="/images/equipe/mateus-3.jpg"
                  alt="Mateus Parreira, fundador da Vamaq Motors"
                  className={styles.imagePhoto}
                />
              </div>
            </div>

            {/* Values */}
            <div className={styles.values}>
              <div className={styles.valueCard}>
                <h3 className={styles.valueTitle}>Curadoria Rigorosa</h3>
                <p className={styles.valueText}>
                  Cada veículo é inspecionado pessoalmente antes de entrar no
                  acervo. Só fica o que passaria no nosso próprio crivo de
                  compra.
                </p>
              </div>
              <div className={styles.valueCard}>
                <h3 className={styles.valueTitle}>Procedência Inegociável</h3>
                <p className={styles.valueText}>
                  Histórico completo, quilometragem verificada, sem sinistro.
                  Aqui transparência não é diferencial — é a regra.
                </p>
              </div>
              <div className={styles.valueCard}>
                <h3 className={styles.valueTitle}>Atendimento Direto</h3>
                <p className={styles.valueText}>
                  Você fala com o Mateus. Sem intermediário, sem roteiro de
                  venda. A negociação é entre você e quem entende do produto.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Conheça nosso espaço */}
        <section className="section">
          <div className="container">
            <div className={styles.spaceIntro}>
              <h2 className={styles.heading}>Conheça nosso espaço</h2>
              <p>
                Nossa loja fica na Av. Francisco Galassi, 1434, em Uberlândia.
                Um showroom pensado para você conhecer de perto cada veículo do
                acervo, com calma e sem pressa. Venha nos visitar — o café fica
                por nossa conta.
              </p>
            </div>
            <div className={styles.spaceGallery}>
              <figure className={styles.spacePhoto}>
                <img
                  src="/images/loja/fachada.jpg"
                  alt="Fachada da loja Vamaq Motors na Av. Francisco Galassi, em Uberlândia"
                  className={styles.spacePhotoImg}
                  loading="lazy"
                />
              </figure>
              <figure className={styles.spacePhoto}>
                <img
                  src="/images/loja/showroom.jpg"
                  alt="Showroom interno da Vamaq Motors com veículos premium em exposição"
                  className={styles.spacePhotoImg}
                  loading="lazy"
                />
              </figure>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="section section--dark">
          <div className="container" style={{ textAlign: "center" }}>
            <h2
              className="section__title"
              style={{ color: "var(--text-on-dark)" }}
            >
              Vamos conversar?
            </h2>
            <p
              className="section__subtitle"
              style={{ marginBottom: "var(--space-lg)" }}
            >
              Fale com um especialista e descubra o carro ideal para você
            </p>
            <a
              href={getWhatsAppGenericUrl(
                "Olá! Gostaria de conhecer a Vamaq Motors."
              )}
              className="btn btn--primary btn--lg"
              target="_blank"
              rel="noopener noreferrer"
            >
              Falar no WhatsApp
            </a>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
