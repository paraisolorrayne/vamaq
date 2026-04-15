"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import { getWhatsAppGenericUrl } from "@/data/vehicles";
import styles from "./contato.module.css";

export default function ContatoPage() {
  const handleSubmit = (e) => {
    e.preventDefault();
    const nome = e.target.nome.value;
    const msg = `Olá! Meu nome é ${nome}. Gostaria de falar com a Vamaq Motors.`;
    window.open(getWhatsAppGenericUrl(msg), "_blank");
  };

  return (
    <>
      <Header />
      <main id="main-content" className={styles.page}>
        <div className="container">
          {/* Hero */}
          <div className={styles.hero}>
            <h1 className={styles.heroTitle}>Fale Conosco</h1>
            <p className={styles.heroSubtitle}>
              Estamos prontos para ajudar você a encontrar o carro ideal
            </p>
          </div>

          {/* Quick contact cards */}
          <div className={styles.cards}>
            <a
              href={getWhatsAppGenericUrl(
                "Olá! Gostaria de mais informações sobre os veículos da Vamaq Motors."
              )}
              className={styles.card}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className={`${styles.cardIcon} ${styles.cardIconWhatsapp}`}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="#25D366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              <div>
                <div className={styles.cardTitle}>WhatsApp</div>
                <div className={styles.cardText}>Resposta rápida e direta</div>
              </div>
            </a>

            <a href="tel:+5511999999999" className={styles.card}>
              <div className={styles.cardIcon}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                </svg>
              </div>
              <div>
                <div className={styles.cardTitle}>Telefone</div>
                <div className={styles.cardText}>(11) 99999-9999</div>
              </div>
            </a>

            <a href="mailto:contato@vamaqmotors.com.br" className={styles.card}>
              <div className={styles.cardIcon}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <div>
                <div className={styles.cardTitle}>E-mail</div>
                <div className={styles.cardText}>contato@vamaqmotors.com.br</div>
              </div>
            </a>
          </div>

          {/* Form + Info */}
          <div className={styles.layout}>
            <div>
              <h2 className={styles.formTitle}>Envie uma Mensagem</h2>
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="nome">Nome completo</label>
                    <input type="text" id="nome" name="nome" placeholder="Seu nome" required />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="telefone">Telefone</label>
                    <input type="tel" id="telefone" name="telefone" placeholder="(11) 99999-9999" required />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="email">E-mail</label>
                  <input type="email" id="email" name="email" placeholder="seu@email.com" required />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="assunto">Assunto</label>
                  <select id="assunto" name="assunto">
                    <option value="">Selecione...</option>
                    <option value="interesse">Interesse em veículo</option>
                    <option value="visita">Agendar visita</option>
                    <option value="financiamento">Financiamento</option>
                    <option value="troca">Avaliação de troca</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="mensagem">Mensagem</label>
                  <textarea id="mensagem" name="mensagem" placeholder="Como podemos ajudar?" />
                </div>
                <button type="submit" className="btn btn--primary btn--lg">
                  Enviar Mensagem
                </button>
              </form>

              <div className={styles.mapPlaceholder}>
                {/* SUBSTITUIR: embed do Google Maps */}
                Mapa — São Paulo, SP
              </div>
            </div>

            <div>
              <h2 className={styles.infoTitle}>Informações</h2>
              <div className={styles.infoItem}>
                <div className={styles.infoIcon}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <div className={styles.infoLabel}>Endereço</div>
                  <div className={styles.infoValue}>São Paulo, SP — Região da Av. Europa</div>
                </div>
              </div>
              <div className={styles.infoItem}>
                <div className={styles.infoIcon}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                  </svg>
                </div>
                <div>
                  <div className={styles.infoLabel}>Telefone</div>
                  <div className={styles.infoValue}>(11) 99999-9999</div>
                </div>
              </div>
              <div className={styles.infoItem}>
                <div className={styles.infoIcon}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div>
                  <div className={styles.infoLabel}>E-mail</div>
                  <div className={styles.infoValue}>contato@vamaqmotors.com.br</div>
                </div>
              </div>
              <div className={styles.infoItem}>
                <div className={styles.infoIcon}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div>
                  <div className={styles.infoLabel}>Horário</div>
                  <div className={styles.infoValue}>Seg–Sex: 9h às 18h · Sáb: 9h às 14h</div>
                </div>
              </div>

              <div className={styles.whatsappBox}>
                <p>Prefere atendimento imediato? Fale direto pelo WhatsApp.</p>
                <a
                  href={getWhatsAppGenericUrl("Olá! Gostaria de falar com a Vamaq Motors.")}
                  className="btn btn--whatsapp btn--full"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
