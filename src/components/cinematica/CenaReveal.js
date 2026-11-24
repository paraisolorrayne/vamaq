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
 * chuva (2172 × 724, editada pela Lorrayne), que entrou no lugar das rodas
 * no mesmo dia.
 *
 * `.quadro` segura a foto nítida e a desfocada juntas. No computador ele
 * cobre o palco; no celular com movimento ele entra no fluxo, entre o atalho
 * e o texto, e encolhe quando falta altura. Antes a foto ficava presa a 36%
 * da tela, e um texto mais alto subia por cima dela (relato do Mateus,
 * 24/11/2026).
 *
 * Abertura em cortina: a foto aparece NÍTIDA por uma faixa de cinema que
 * abre, sozinha ao entrar e até a tela cheia com a rolagem, enquanto a
 * câmera recua. Fora da faixa fica a mesma foto desfocada: os carros
 * "entram em foco".
 */
const FOTO = "/images/loja/quatro-911.webp";

export default function CenaReveal() {
  const whatsapp = getWhatsAppGenericUrl(
    "Olá! Vi o site da Vamaq Motors e gostaria de agendar uma visita."
  );

  return (
    <section
      className={styles.cena}
      data-cena="reveal"
      aria-labelledby="reveal-titulo"
    >
      <div className={styles.palco}>
        <div className={styles.quadro}>
          <div className={styles.desfoque} aria-hidden="true">
            {/* Foto pequena de propósito: desfocada, 384 px bastam. Mas é
              ELA o maior elemento ao abrir (a nítida está recortada na
              faixa), então é o LCP: sai na frente, não adiada. */}
            <Image
              src={FOTO}
              alt=""
              className={styles.desfoqueImg}
              data-r="desfoque"
              fill
              sizes="25vw"
              loading="eager"
              fetchPriority="high"
            />
          </div>
          <div className={styles.foto} data-r="foto">
            <Image
              src={FOTO}
              alt="Quatro Porsche 911, vermelhos e azuis, num pátio molhado de chuva"
              className={styles.img}
              data-r="img"
              fill
              sizes="100vw"
              loading="eager"
              fetchPriority="high"
            />
          </div>
        </div>
        <div className={styles.sombra} aria-hidden="true" />

        <p className={styles.dica} data-r="dica" aria-hidden="true">
          Role para revelar
        </p>
        <Link href="/acervo" className={styles.atalho}>
          Ir direto ao showroom
        </Link>

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
