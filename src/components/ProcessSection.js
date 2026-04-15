import styles from './ProcessSection.module.css';

const STEPS = [
  {
    number: 'Passo 01',
    title: 'Escolha',
    text: 'Navegue pelo nosso acervo e encontre o carro ideal',
    icon: 'search',
  },
  {
    number: 'Passo 02',
    title: 'Consulte',
    text: 'Entre em contato para condições e agendamento',
    icon: 'chat',
  },
  {
    number: 'Passo 03',
    title: 'Visite',
    text: 'Conheça o veículo pessoalmente na nossa loja',
    icon: 'map-pin',
  },
  {
    number: 'Passo 04',
    title: 'Realize',
    text: 'Finalize a negociação e saia com seu carro',
    icon: 'check-circle',
  },
];

function StepIcon({ name }) {
  const props = {
    className: styles.icon,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  switch (name) {
    case 'search':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'chat':
      return (
        <svg {...props}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'map-pin':
      return (
        <svg {...props}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case 'check-circle':
      return (
        <svg {...props}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    default:
      return null;
  }
}

export default function ProcessSection() {
  return (
    <section className={styles.section} aria-label="Como funciona">
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Simples. Rápido. Sem Burocracia.</h2>
          <p className={styles.subtitle}>
            Seu próximo carro de luxo em quatro passos
          </p>
        </div>

        <div className={styles.grid}>
          {STEPS.map((step) => (
            <div key={step.title} className={styles.step}>
              <div className={styles.connector} aria-hidden="true" />
              <div className={styles.iconWrap}>
                <StepIcon name={step.icon} />
              </div>
              <span className={styles.stepNumber}>{step.number}</span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepText}>{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
