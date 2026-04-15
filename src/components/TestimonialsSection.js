import styles from './TestimonialsSection.module.css';

const TESTIMONIALS = [
  {
    id: 1,
    text: 'Atendimento impecável do início ao fim. Encontrei exatamente o carro que procurava e toda a documentação estava perfeita. Recomendo sem hesitar.',
    author: 'Ricardo M.',
  },
  {
    id: 2,
    text: 'A curadoria da Vamaq é outro nível. Cada detalhe do meu Porsche foi verificado e a procedência era totalmente transparente. Experiência premium de verdade.',
    author: 'Fernanda L.',
  },
  {
    id: 3,
    text: 'Terceiro veículo que compro com a Vamaq. A confiança e profissionalismo fazem toda a diferença quando se trata de carros desse nível.',
    author: 'Carlos A.',
  },
  {
    id: 4,
    text: 'Processo simples e sem burocracia. O Mateus entende do mercado como ninguém e me ajudou a fazer a melhor escolha para o meu perfil.',
    author: 'Ana Paula S.',
  },
];

function StarIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export default function TestimonialsSection() {
  return (
    <section className={styles.section} aria-label="Depoimentos de clientes">
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Quem Confia na Vamaq</h2>
          <p className={styles.subtitle}>
            A satisfação dos nossos clientes é o nosso maior patrimônio
          </p>
        </div>

        <div className={styles.carousel} role="list" aria-label="Depoimentos">
          {TESTIMONIALS.map((t) => (
            <article key={t.id} className={styles.card} role="listitem">
              <span className={styles.quoteIcon} aria-hidden="true">
                &ldquo;
              </span>
              <p className={styles.text}>{t.text}</p>
              <div className={styles.stars} aria-label="5 de 5 estrelas">
                {[1, 2, 3, 4, 5].map((star) => (
                  <StarIcon key={star} className={styles.starIcon} />
                ))}
              </div>
              <span className={styles.author}>{t.author}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
