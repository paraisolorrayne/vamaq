import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import { getWhatsAppGenericUrl } from "@/data/vehicles";
import styles from "./sobre.module.css";

export const metadata = {
  title: "Sobre",
  description:
    "Conheça a Vamaq Motors — mais de 13 anos de experiência no mercado automotivo de luxo.",
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
            Mais de 13 anos conectando pessoas a veículos extraordinários
          </p>
        </div>

        {/* Content */}
        <section className="section">
          <div className="container">
            <div className={styles.content}>
              <div className={styles.text}>
                <h2 className={styles.heading}>Nossa História</h2>
                <p>
                  A Vamaq Motors nasceu da paixão por veículos de alta
                  performance e da visão de criar uma experiência de compra à
                  altura dos carros que comercializamos. Liderada por Mateus
                  Parreira, administrador de marketing com mais de 13 anos de
                  vivência no mercado automotivo de luxo, a empresa se
                  consolidou como referência em curadoria de veículos premium.
                </p>
                <p>
                  Cada carro que entra no nosso acervo passa por uma
                  verificação rigorosa de procedência, histórico de manutenção
                  e estado de conservação. Não trabalhamos com volume —
                  trabalhamos com excelência.
                </p>

                <h2 className={styles.heading}>Nosso Diferencial</h2>
                <p>
                  Enquanto concessionárias tradicionais focam em volume de
                  vendas, nós focamos em experiência. Cada cliente é atendido
                  de forma personalizada, com transparência total em cada etapa
                  da negociação. Nosso objetivo não é vender um carro — é
                  construir uma relação de confiança que dure.
                </p>
                <p>
                  Trabalhamos exclusivamente com marcas que definem o segmento
                  premium: Porsche, BMW, Mercedes-AMG, Ferrari, Lamborghini,
                  McLaren, Audi, Range Rover, Bentley e Maserati.
                </p>
              </div>
              <div className={styles.imagePlaceholder}>
                {/* SUBSTITUIR: foto real da loja ou equipe */}
                Foto Institucional
              </div>
            </div>

            {/* Values */}
            <div className={styles.values}>
              <div className={styles.valueCard}>
                <h3 className={styles.valueTitle}>Curadoria Rigorosa</h3>
                <p className={styles.valueText}>
                  Cada veículo é selecionado e inspecionado pessoalmente. Só
                  trabalhamos com carros que passam nos nossos critérios de
                  qualidade.
                </p>
              </div>
              <div className={styles.valueCard}>
                <h3 className={styles.valueTitle}>Procedência Garantida</h3>
                <p className={styles.valueText}>
                  Histórico completo, quilometragem verificada, sem sinistro. A
                  transparência é inegociável.
                </p>
              </div>
              <div className={styles.valueCard}>
                <h3 className={styles.valueTitle}>Atendimento Premium</h3>
                <p className={styles.valueText}>
                  Cada cliente recebe atenção personalizada. Sem pressão, sem
                  pressa. A experiência é tão importante quanto o carro.
                </p>
              </div>
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
