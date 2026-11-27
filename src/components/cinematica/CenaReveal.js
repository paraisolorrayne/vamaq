import Image from "next/image";
import Link from "next/link";
import { getWhatsAppGenericUrl } from "@/lib/whatsapp";
import styles from "./CenaReveal.module.css";

/**
 * Cena 1 — a abertura da home. O movimento mora no CinematicaMotion; aqui é
 * só o HTML, que já é a versão estática.
 *
 * Desde 24/11/2026 é a abertura da MARCA, sem nome, ano nem preço de carro.
 * Antes era o primeiro destaque do estoque (o 911 amarelo). Com a foto de
 * outros carros, o nome e o preço do destaque contariam ao cliente uma coisa
 * que a foto não mostra. Por isso os textos são os que o site já usa (layout
 * e rodapé), nada novo afirmado. A foto é a panorâmica dos quatro 911 na
 * chuva (2172 × 724, editada pela Lorrayne).
 *
 * Abre com a foto NÍTIDA e o texto já na tela. Até 26/11/2026 era uma
 * cortina: uma faixa nítida no meio da mesma foto desfocada, com o texto só
 * no fim de uma trilha longa de rolagem. Parado no topo, o site parecia
 * "uma foto borrada e quebrada" (Lorrayne). Agora o movimento é só a foto
 * recuando ao abrir e descendo mais devagar que a página ao sair.
 */
const FOTO = "/images/loja/quatro-911.webp";

export default function CenaReveal() {
  const whatsapp = getWhatsAppGenericUrl(
    "Olá! Vi o site da Vamaq Motors e gostaria de agendar uma visita."
  );

  return (
    <section className={styles.cena} data-cena="reveal" aria-labelledby="reveal-titulo">
      <div className={styles.palco}>
        <div className={styles.quadro} data-r="quadro">
          <Image
            src={FOTO}
            alt="Quatro Porsche 911, vermelhos e azuis, num pátio molhado de chuva"
            className={styles.img}
            fill
            sizes="100vw"
            loading="eager"
            fetchPriority="high"
          />
        </div>
        <div className={styles.sombra} aria-hidden="true" />

        <div className={styles.info} data-r="info">
          <div className={styles.textos}>
            <p className={styles.contexto}>Vamaq Motors</p>
            <h1 id="reveal-titulo" className={styles.titulo}>
              Curadoria de carros especiais
            </h1>
            <p className={styles.texto}>
              Boutique automotiva especializada em veículos premium, esportivos
              e superesportivos. Curadoria rigorosa e procedência garantida.
            </p>
            <div className={styles.acoes}>
              <Link href="/acervo" className={styles.primario}>
                Ver showroom
              </Link>
              <a
                href={whatsapp}
                className={styles.secundario}
                target="_blank"
                rel="noopener noreferrer"
              >
                Agendar visita
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
