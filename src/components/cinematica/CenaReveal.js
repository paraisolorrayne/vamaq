import Image from "next/image";
import Link from "next/link";
import { anoVeiculo } from "@/lib/anoVeiculo";
import { letrasDaMaiorPalavra } from "@/lib/maiorPalavra";
import { formatarKm, formatarPreco } from "@/lib/home/cinematica";
import styles from "./CenaReveal.module.css";

/**
 * Cena 1 — o destaque do showroom revelado. A foto é a capa do cadastro, sem
 * retoque. O movimento mora no CinematicaMotion; aqui é só o HTML, que já é
 * a versão estática.
 *
 * Duas aberturas para comparar (`efeito`, vem de ?abertura= na /previa):
 *  - "cortina" (padrão): a foto aparece NÍTIDA por uma faixa de cinema que
 *    abre — sozinha ao entrar e até a tela cheia com a rolagem — enquanto a
 *    câmera recua. Fora da faixa, a mesma foto desfocada (pedido de
 *    24/10/2026, no lugar das faixas lisas): o carro "entra em foco".
 *  - "luz": a primeira versão — facho de luz com borda esfumada e exposição
 *    subindo. Em 24/10/2026 a Lorrayne achou que o esfumado "mata o site";
 *    ficou só para comparação.
 */
export default function CenaReveal({ vehicle, efeito = "cortina" }) {
  if (!vehicle?.images?.main) return null;
  const ano = anoVeiculo(vehicle);

  return (
    <section
      className={`${styles.cena} ${efeito === "luz" ? styles.luz : styles.cortina}`}
      data-cena="reveal"
      data-efeito={efeito}
      aria-labelledby="reveal-modelo"
    >
      <div className={styles.palco}>
        {efeito !== "luz" && (
          <div className={styles.desfoque} aria-hidden="true">
            {/* Foto pequena de propósito: desfocada, 384 px bastam. Mas é
                ELA o maior elemento ao abrir (a nítida está recortada na
                faixa), então é o LCP: sai na frente, não adiada — adiada,
                o LCP do celular foi de 2,0 s para 2,6 s. */}
            <Image
              src={vehicle.images.main}
              alt=""
              className={styles.desfoqueImg}
              data-r="desfoque"
              fill
              sizes="25vw"
              loading="eager"
              fetchPriority="high"
            />
          </div>
        )}
        <div className={styles.foto} data-r="foto">
          <Image
            src={vehicle.images.main}
            alt={`${vehicle.brand} ${vehicle.model} ${ano}`}
            className={styles.img}
            data-r="img"
            fill
            // Mesmo pedido da home (100vw): pedir a foto maior que a tela
            // custava ~0,4 s de LCP no celular.
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
            <p className={styles.contexto}>Destaque do showroom</p>
            <p className={styles.marcaCarro}>{vehicle.brand}</p>
            <h1
              id="reveal-modelo"
              className={styles.modelo}
              style={{ "--letras": letrasDaMaiorPalavra(vehicle.model) }}
            >
              {vehicle.model}
            </h1>
            <p className={styles.fatos}>
              <span>{ano}</span>
              <span>{formatarKm(vehicle)}</span>
            </p>
            <p className={styles.preco}>{formatarPreco(vehicle)}</p>
            <div className={styles.acoes}>
              <Link href={`/veiculo/${vehicle.slug}`} className={styles.primario}>
                Explorar veículo
              </Link>
              <Link href="/acervo" className={styles.secundario}>
                Ver showroom
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
