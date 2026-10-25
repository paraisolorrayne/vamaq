import Image from "next/image";
import Link from "next/link";
import { anoVeiculo } from "@/lib/anoVeiculo";
import { letrasDaMaiorPalavra } from "@/lib/maiorPalavra";
import { fotosDoVeiculo, formatarKm, formatarPreco } from "@/lib/home/cinematica";
import styles from "./CenaVitrine.module.css";

const dois = (n) => String(n).padStart(2, "0");

/**
 * Cena 2 — carros do estoque em camadas. Todos foram fotografados no mesmo
 * lugar (a fachada), então trocar um carro pelo outro no mesmo quadro parece
 * um palco girando. As fotos 2 a 4 do cadastro entram como "outros ângulos"
 * sem legenda: não sabemos o que cada uma mostra (ver lib/home/cinematica.js).
 */
export default function CenaVitrine({ veiculos, totalEstoque }) {
  if (!veiculos.length) return null;
  const n = veiculos.length;

  return (
    <section
      className={styles.cena}
      data-cena="vitrine"
      aria-labelledby="vitrine-titulo"
      style={{ "--placas": n }}
    >
      <div className={styles.palco}>
        <div className={styles.topo}>
          <h2 id="vitrine-titulo" className={styles.titulo}>
            No showroom agora
          </h2>
          <p className={styles.contador} aria-hidden="true">
            <span data-v="atual">01</span> / {dois(n)}
          </p>
          <Link href="/acervo" className={styles.atalho}>
            Ver os {totalEstoque} carros
          </Link>
        </div>

        <ol className={styles.placas}>
          {veiculos.map((v) => {
            const fotos = fotosDoVeiculo(v);
            const nome = `${v.brand} ${v.model} ${anoVeiculo(v)}`;
            return (
              <li key={v.id} className={styles.placa} data-v="placa">
                <p className={styles.fundo} data-v="fundo" aria-hidden="true">
                  {v.brand}
                </p>

                <Link
                  href={`/veiculo/${v.slug}`}
                  className={styles.principal}
                  aria-label={`Ver ${nome}`}
                >
                  <Image
                    src={fotos[0]}
                    alt={nome}
                    className={styles.img}
                    data-v="angulo"
                    fill
                    sizes="(min-width: 900px) 60vw, 100vw"
                  />
                  {fotos[1] && (
                    <Image
                      src={fotos[1]}
                      alt=""
                      className={`${styles.img} ${styles.anguloB}`}
                      data-v="angulo-b"
                      fill
                      sizes="(min-width: 900px) 60vw, 100vw"
                    />
                  )}
                </Link>

                {fotos.slice(2, 4).map((src, k) => (
                  <div
                    key={src}
                    className={`${styles.detalhe} ${k === 0 ? styles.detalhe1 : styles.detalhe2}`}
                    data-v="detalhe"
                    aria-hidden="true"
                  >
                    <Image src={src} alt="" className={styles.img} fill sizes="(min-width: 900px) 20vw, 40vw" />
                  </div>
                ))}

                <div className={styles.texto} data-v="texto">
                  <p className={styles.marcaCarro}>{v.brand}</p>
                  <h3
                    className={styles.modelo}
                    style={{ "--letras": letrasDaMaiorPalavra(v.model) }}
                  >
                    {v.model}
                  </h3>
                  <p className={styles.fatos}>
                    {anoVeiculo(v)} · {formatarKm(v)}
                  </p>
                  <p className={styles.preco}>{formatarPreco(v)}</p>
                  <Link href={`/veiculo/${v.slug}`} className={styles.link}>
                    Ver este carro
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
