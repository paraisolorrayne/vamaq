import Image from "next/image";
import Link from "next/link";
import { getWhatsAppGenericUrl } from "@/lib/whatsapp";
import styles from "./CenaReveal.module.css";

/**
 * Cena 1 — a abertura da home. O movimento mora no CinematicaMotion; aqui é
 * só o HTML, que já é a versão estática.
 *
 * Desde 24/11/2026 é a abertura da MARCA: a foto das rodas de dois 911 (a
 * versão editada pela Lorrayne, a mesma do .png "Porsche Wheels on a Rainy
 * Driveway"), sem nome, ano nem preço de carro. Antes era o primeiro destaque
 * do estoque (o 911 amarelo). Com a foto de outros carros, o nome e o preço
 * do destaque contariam ao cliente uma coisa que a foto não mostra. Por isso
 * os textos são os que o site já usa (layout e rodapé), nada novo afirmado.
 * A foto tem só 941 px de largura: no computador sai ampliada (pedido dela,
 * mesmo assim).
 *
 * Abertura em cortina: a foto aparece NÍTIDA por uma faixa de cinema que
 * abre, sozinha ao entrar e até a tela cheia com a rolagem, enquanto a
 * câmera recua. Fora da faixa fica a mesma foto desfocada: os carros
 * "entram em foco".
 */
const FOTO = "/images/loja/rodas-911.webp";

export default function CenaReveal() {
  const whatsapp = getWhatsAppGenericUrl(
    "Olá! Vi o site da Vamaq Motors e gostaria de agendar uma visita."
  );

  return (
    <section className={styles.cena} data-cena="reveal" aria-labelledby="reveal-titulo">
      <div className={styles.palco}>
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
            alt="Rodas de dois Porsche 911, um vermelho e um azul, frente a frente"
            className={styles.img}
            data-r="img"
            fill
            sizes="100vw"
            loading="eager"
            fetchPriority="high"
          />
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
