import { getImageProps } from "next/image";
import Link from "next/link";
import { BUSINESS, MAPS_QUERY_URL } from "@/lib/businessInfo";
import { getWhatsAppGenericUrl } from "@/lib/whatsapp";
import styles from "./CenaBoutique.module.css";

/**
 * Cena 4 — dos carros para a loja. Três fotos reais, enviadas pela Vamaq em
 * 25/09/2026: a fachada ao anoitecer, a frente com os faróis acesos e o
 * salão. As passagens são cortes pelo branco, nunca fusão: as fotos foram
 * tiradas à mão, e o par "faróis apagados / acesos" fundido duplicava o 911
 * (testado em 24/10/2026) — por isso o apagado nem entrou.
 *
 * No celular (tela em pé) as fachadas horizontais mostravam ~30% da largura;
 * desde 19/11/2026 a primeira batida troca por uma foto em pé
 * (`movel`, via <picture> — "art direction" da doc do next/image). A
 * segunda também trocava (rodas dos 911) até a foto virar a abertura da
 * home, em 24/11/2026. Mesmo
 * breakpoint do CSS e do CinematicaMotion: 900px.
 *
 * Os textos são os que o site já usa (home e /sobre); nada novo afirmado.
 */
const CELULAR = "(max-width: 899.98px)";

const BATIDAS = [
  {
    src: "/images/loja/fachada-anoitecer.webp",
    // O <img> é um só: o alt tem que valer para as duas fotos.
    alt: "Fachada da Vamaq Motors com o letreiro aceso e carros na frente",
    posicao: "57% 50%",
    // Os dois 911 diante do totem com o letreiro (18/11/2026).
    movel: {
      src: "/images/loja/totem-911.webp",
      // Parada (quadro 3:4) a altura importa: 20% guarda o letreiro do totem.
      posicao: "50% 20%",
    },
  },
  {
    src: "/images/loja/fachada-farois.webp",
    alt: "Frente da Vamaq Motors com os faróis dos carros acesos",
    // A foto das rodas que ficava aqui no celular virou a abertura da home
    // em 24/11/2026; repetida, aparecia duas vezes na mesma página. No
    // celular: a 320i e o 911 de faróis acesos.
    posicao: "62% 55%",
    posicaoMovel: "92% 60%",
  },
  {
    src: "/images/loja/salao.webp",
    alt: "Salão da Vamaq Motors com carros expostos",
    posicao: "70% 60%",
    posicaoMovel: "84% 60%",
  },
];

// Variáveis, não objectPosition: estilo inline venceria a regra de celular
// do CSS. `--pos-movel` vale só abaixo de 900px (ver o .module.css).
function Foto({ batida: b }) {
  const comum = { alt: b.alt, fill: true, sizes: "100vw" };
  const posMovel = b.movel?.posicao ?? b.posicaoMovel;
  const {
    props: { srcSet: desktop, ...img },
  } = getImageProps({
    ...comum,
    src: b.src,
    style: { "--pos": b.posicao, "--pos-movel": posMovel },
  });
  const props = { ...img, srcSet: desktop, className: styles.img, "data-b": "img" };
  // <img> cru de propósito: as props já saíram otimizadas do getImageProps.
  // eslint-disable-next-line @next/next/no-img-element
  if (!b.movel) return <img {...props} alt={b.alt} />;

  const {
    props: { srcSet: celular },
  } = getImageProps({ ...comum, src: b.movel.src });
  return (
    <picture>
      <source media={CELULAR} srcSet={celular} sizes="100vw" />
      <img {...props} alt={b.alt} />
    </picture>
  );
}

export default function CenaBoutique() {
  const whatsapp = getWhatsAppGenericUrl(
    "Olá! Vi o site da Vamaq Motors e gostaria de agendar uma visita."
  );
  const { street, number, neighborhood, city, state } = BUSINESS.address;

  return (
    <section className={styles.cena} data-cena="boutique" aria-labelledby="boutique-titulo">
      <div className={styles.palco}>
        {BATIDAS.map((b, i) => (
          <div key={b.src} className={styles.batida} data-b="batida">
            <figure className={styles.quadro} data-em-pe={b.movel ? "" : undefined}>
              <Foto batida={b} />
            </figure>

            <div className={styles.legenda} data-b="legenda">
              {i === 0 && (
                <>
                  <p className={styles.kicker}>A boutique</p>
                  <h2 id="boutique-titulo" className={styles.titulo}>
                    {street}, {number}
                  </h2>
                  <p className={styles.texto}>
                    {neighborhood} · {city} – {state}
                  </p>
                </>
              )}
              {i === 1 && (
                <>
                  <p className={styles.kicker}>Curadoria Vamaq</p>
                  <h2 className={styles.titulo}>Não é volume. É seleção.</h2>
                  <p className={styles.texto}>
                    O showroom muda conforme chegam veículos com procedência,
                    configuração e estado compatíveis com o padrão da Vamaq.
                  </p>
                </>
              )}
              {i === 2 && (
                <>
                  <p className={styles.kicker}>Procedência</p>
                  <h2 className={styles.titulo}>
                    Cada veículo entra no showroom por um motivo.
                  </h2>
                  <p className={styles.texto}>
                    Liderada por Mateus Parreira, com mais de 13 anos de
                    experiência no mercado automotivo de luxo. Curadoria
                    rigorosa, procedência garantida e os esportivos mais
                    desejados do mercado.
                  </p>
                  <div className={styles.acoes}>
                    <Link href="/acervo" className={styles.primario}>
                      Ver showroom
                    </Link>
                    <a
                      href={MAPS_QUERY_URL}
                      className={styles.secundario}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Como chegar
                    </a>
                    <a
                      href={whatsapp}
                      className={styles.secundario}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Agendar visita
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
        <div className={styles.veu} data-b="veu" aria-hidden="true" />
      </div>
    </section>
  );
}
