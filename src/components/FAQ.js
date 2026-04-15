'use client';

import { useState, useCallback } from 'react';
import styles from './FAQ.module.css';

const FAQ_DATA = [
  {
    id: 'compra',
    question: 'Como funciona a compra de um veículo?',
    answer:
      'O processo é simples: escolha o veículo no nosso acervo, entre em contato pelo WhatsApp ou telefone, agende uma visita para conhecer o carro pessoalmente e, após a aprovação, finalizamos toda a documentação. Cuidamos de cada etapa para que sua experiência seja tranquila e sem burocracia.',
  },
  {
    id: 'financiamento',
    question: 'Vocês oferecem financiamento?',
    answer:
      'Sim, trabalhamos com as melhores instituições financeiras do mercado para oferecer condições especiais de financiamento. Nossa equipe analisa o melhor plano para o seu perfil, com taxas competitivas e parcelas que cabem no seu planejamento.',
  },
  {
    id: 'procedencia',
    question: 'Os veículos possuem procedência verificada?',
    answer:
      'Absolutamente. Todos os veículos do nosso acervo passam por uma curadoria rigorosa que inclui verificação completa de procedência, histórico de manutenção, laudo cautelar e inspeção mecânica detalhada. Garantimos 100% de transparência em cada negociação.',
  },
  {
    id: 'test-drive',
    question: 'Posso fazer um test drive?',
    answer:
      'Claro! Acreditamos que a experiência de dirigir é fundamental na decisão de compra. Agende seu test drive pelo WhatsApp ou telefone e venha sentir de perto o desempenho do veículo que escolheu.',
  },
  {
    id: 'troca',
    question: 'Vocês aceitam veículo na troca?',
    answer:
      'Sim, aceitamos o seu veículo como parte do pagamento. Nossa equipe realiza uma avaliação justa e transparente, e o valor é abatido diretamente na negociação. Consulte-nos para mais detalhes sobre o processo de avaliação.',
  },
  {
    id: 'localizacao',
    question: 'Onde fica a loja?',
    answer:
      'Estamos localizados em São Paulo, em uma região de fácil acesso. Entre em contato pelo WhatsApp para obter o endereço completo e instruções de como chegar. Funcionamos de segunda a sábado, das 9h às 18h.',
  },
];

export default function FAQ() {
  const [openId, setOpenId] = useState(null);

  const toggle = useCallback((id) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <section className={styles.section} aria-label="Perguntas frequentes">
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Dúvidas Frequentes</h2>
          <p className={styles.subtitle}>
            Tudo o que você precisa saber antes de visitar a Vamaq
          </p>
        </div>

        <div className={styles.list} role="list">
          {FAQ_DATA.map((item) => {
            const isOpen = openId === item.id;

            return (
              <div key={item.id} className={styles.item} role="listitem">
                <button
                  className={styles.trigger}
                  onClick={() => toggle(item.id)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${item.id}`}
                  id={`faq-trigger-${item.id}`}
                >
                  <span>{item.question}</span>
                  <span
                    className={`${styles.triggerIcon} ${isOpen ? styles.triggerIconOpen : ''}`}
                    aria-hidden="true"
                  >
                    <svg
                      className={styles.iconSvg}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </span>
                </button>

                <div
                  id={`faq-panel-${item.id}`}
                  role="region"
                  aria-labelledby={`faq-trigger-${item.id}`}
                  className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
                >
                  <p className={styles.answer}>{item.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
