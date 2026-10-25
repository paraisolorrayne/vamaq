import Image from "next/image";
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
 * Os textos são os que o site já usa (home e /sobre); nada novo afirmado.
 */
const BATIDAS = [
  {
    src: "/images/loja/fachada-anoitecer.webp",
    alt: "Fachada da Vamaq Motors ao anoitecer, com o letreiro aceso e carros na frente",
    // No celular (tela em pé) cabe ~30% da largura: o letreiro principal.
    posicao: "57% 50%",
    posicaoMovel: "71% 50%",
  },
  {
    src: "/images/loja/fachada-farois.webp",
    alt: "Frente da Vamaq Motors com os faróis dos carros acesos",
    // No celular, a 320i e o 911 de faróis acesos — o motivo desta foto.
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
            <figure className={styles.quadro}>
              <Image
                src={b.src}
                alt={b.alt}
                className={styles.img}
                data-b="img"
                // Variáveis, não objectPosition: estilo inline venceria a
                // regra de celular do CSS.
                style={{ "--pos": b.posicao, "--pos-movel": b.posicaoMovel }}
                fill
                sizes="100vw"
              />
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
