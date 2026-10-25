import Link from 'next/link';
import Image from 'next/image';
import { anoVeiculo } from '@/lib/anoVeiculo';
import styles from './VehicleCard.module.css';

function formatKm(km) {
  return km.toLocaleString('pt-BR');
}

function getBadgeClass(badge) {
  if (!badge) return '';
  const map = {
    'Novo': styles.badgeNew,
    'Destaque': styles.badgeFeatured,
    'Blindado': styles.badgeArmored,
  };
  return map[badge] || styles.badgeNew;
}

/**
 * Card do acervo: foto grande, nome, preço e uma linha de dados. O card
 * inteiro é o link para a página do carro — o botão "Tenho Interesse" que
 * havia em cada card (nove botões pretos iguais por página) saiu em
 * 20/10/2026; o contato fica na página do carro e no botão flutuante.
 *
 * `prioridade` marca o card que está acima da dobra — quem renderiza a grade
 * sabe qual é o primeiro, o card não. Só o primeiro deve receber: marcar
 * vários faz o navegador disputar banda com eles mesmos e o LCP piora.
 *
 * Só o acervo liga os dois abaixo (24/10/2026):
 *  - `profundidade`: a foto fica numa camada um pouco maior que a moldura,
 *    que o ParallaxFotos desliza com a rolagem;
 *  - `outroAngulo`: monta a segunda foto do cadastro, que entra por cima com
 *    uma cortina lateral no hover. Quem decide quando montar é a grade (no
 *    primeiro movimento do mouse sobre ela): montar sempre baixaria o dobro
 *    de fotos para quem está no celular, onde não há hover.
 */
export default function VehicleCard({ vehicle, prioridade = false, profundidade = false, outroAngulo = false }) {
  const dados = [
    anoVeiculo(vehicle),
    vehicle.mileage != null ? `${formatKm(vehicle.mileage)} km` : '',
    vehicle.fuel,
  ].filter(Boolean);
  const segunda = outroAngulo
    ? (vehicle.images?.gallery || []).find((u) => u && u !== vehicle.images?.main)
    : null;

  return (
    <article className={styles.card}>
      <Link href={`/veiculo/${vehicle.slug}`} className={styles.link}>
        <div className={styles.imageWrap}>
          {vehicle.images?.main ? (
            <div className={`${styles.camada} ${profundidade ? styles.camadaProfunda : ''}`} data-parallax={profundidade ? '' : undefined}>
              <Image
                src={vehicle.images.main}
                alt={`${vehicle.brand} ${vehicle.model} ${anoVeiculo(vehicle)}`}
                className={styles.image}
                // O wrap já tem position:relative e aspect-ratio 4/3, então o
                // espaço está reservado antes da foto chegar: sem fill seria
                // preciso repetir as medidas aqui e no CSS, e as duas divergiriam.
                fill
                // Sem `sizes` o Next assume 100vw e serve a foto inteira para um
                // card de um terço de tela. Estes cortes acompanham o grid do
                // acervo (1 coluna no celular, 2 no tablet, 3 no desktop).
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                // O primeiro card da primeira dobra costuma ser o LCP da página.
                // `priority` foi depreciado no Next 16 — a forma atual é dizer ao
                // navegador para não adiar e priorizar a busca.
                loading={prioridade ? 'eager' : 'lazy'}
                fetchPriority={prioridade ? 'high' : 'auto'}
              />
              {segunda && (
                <Image
                  src={segunda}
                  alt=""
                  className={`${styles.image} ${styles.outroAngulo}`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  loading="lazy"
                />
              )}
            </div>
          ) : (
            <div className={styles.placeholder}>
              <svg
                className={styles.placeholderIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          )}

          {vehicle.badge && (
            <span className={`${styles.badge} ${getBadgeClass(vehicle.badge)}`}>
              {vehicle.badge}
            </span>
          )}
        </div>

        <div className={styles.body}>
          <h3 className={styles.title}>
            {vehicle.brand} {vehicle.model}
          </h3>

          {vehicle.price ? (
            <p className={styles.price}>
              {vehicle.price.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: 0,
              })}
            </p>
          ) : (
            <p className={styles.priceConsult}>Consulte</p>
          )}

          <p className={styles.meta}>{dados.join(' · ')}</p>
        </div>
      </Link>
    </article>
  );
}
