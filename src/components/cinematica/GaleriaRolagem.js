'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import CinematicaMotion from './CinematicaMotion';
import styles from './GaleriaRolagem.module.css';

const dois = (n) => String(n).padStart(2, '0');

function Seta({ lado }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {lado === 'esquerda' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 6 15 12 9 18" />}
    </svg>
  );
}

/**
 * As fotos da ficha andando com a rolagem (apresentação do carro). O topo da
 * ficha fica como sempre; só esta faixa muda: com movimento, a página para
 * aqui e a rolagem para baixo passa as fotos para o lado — cada uma cresce
 * ao chegar no meio e a imagem desliza dentro do quadro (CinematicaMotion,
 * montarGaleria). Sem movimento, é a faixa rolável de lado de sempre.
 *
 * Todas as fotos com opacidade cheia e sem filtro: a galeria normal apaga as
 * que não estão no meio, e foto apagada é o que a Lorrayne chamou de
 * "desfoque matando o site".
 *
 * As setas funcionam nos dois modos: paradas, rolam a faixa; com movimento,
 * rolam a PÁGINA até a posição da foto — que é o que move a faixa.
 */
export default function GaleriaRolagem({ fotos, vehicle, ano, onAbrir }) {
  const secaoRef = useRef(null);
  const filaRef = useRef(null);
  const [atual, setAtual] = useState(0);
  const n = fotos.length;

  // Sem movimento a faixa rola sozinha (dedo, trackpad): o contador segue.
  const aoRolarFila = useCallback(() => {
    const fila = filaRef.current;
    const item = fila?.firstElementChild;
    if (!item) return;
    const passo = item.getBoundingClientRect().width + 12;
    setAtual(Math.min(n - 1, Math.max(0, Math.round(fila.scrollLeft / passo))));
  }, [n]);

  const irPara = useCallback(
    (alvo) => {
      const i = Math.min(n - 1, Math.max(0, alvo));
      const secao = secaoRef.current;
      const fila = filaRef.current;
      if (!secao || !fila) return;
      if (document.documentElement.dataset.cine === 'on' && 'cinePronto' in document.documentElement.dataset) {
        // Mesma conta do ScrollTrigger (start "top top", end "bottom bottom").
        const inicio = secao.getBoundingClientRect().top + window.scrollY;
        const percurso = secao.offsetHeight - window.innerHeight;
        window.scrollTo({ top: inicio + (percurso * i) / Math.max(1, n - 1), behavior: 'smooth' });
      } else {
        const item = fila.children[i];
        if (item) fila.scrollTo({ left: item.offsetLeft - fila.offsetLeft, behavior: 'smooth' });
      }
    },
    [n]
  );

  const atualNaTela = () => {
    const texto = secaoRef.current?.querySelector('[data-g="atual"]')?.textContent;
    return (Number(texto) || atual + 1) - 1;
  };

  return (
    <section
      id="imagens"
      ref={secaoRef}
      className={styles.galeria}
      data-cena="galeria"
      style={{ '--fotos': n }}
      aria-labelledby="galeria-titulo"
    >
      <div className={styles.palco}>
        {/* data-revela: título e controles entram com a galeria
            (RevelaAoRolar, na ficha). A faixa não: o transform dela é do
            GSAP, e uma transição CSS por cima atrasaria a rolagem. */}
        <div className={styles.topo} data-revela="">
          <div>
            <p className={styles.marca}>{vehicle.brand}</p>
            <h2 id="galeria-titulo" className={styles.titulo}>
              {vehicle.model} <span>· {n} fotos</span>
            </h2>
          </div>
          <CinematicaMotion emLinha />
        </div>

        <ul
          ref={filaRef}
          className={styles.fila}
          data-g="fila"
          onScroll={aoRolarFila}
          tabIndex={0}
          aria-label="Fotos do carro"
        >
          {fotos.map((src, i) => (
            <li key={`${src}-${i}`} className={styles.item} data-g="item">
              <button
                type="button"
                className={styles.quadro}
                onClick={() => onAbrir(i)}
                aria-label={`Ampliar foto ${i + 1} de ${n}`}
              >
                <Image
                  src={src}
                  alt={`${vehicle.brand} ${vehicle.model} ${ano} — foto ${i + 1} de ${n}`}
                  className={styles.img}
                  data-g="img"
                  fill
                  sizes="(min-width: 900px) 70vw, 86vw"
                  loading={i < 2 ? 'eager' : 'lazy'}
                  draggable={false}
                />
              </button>
            </li>
          ))}
        </ul>

        <div className={styles.controles} data-revela="">
          <span className={styles.contador} aria-hidden="true">
            <span data-g="atual">{dois(atual + 1)}</span> / {dois(n)}
          </span>
          <div className={styles.progresso} aria-hidden="true">
            <span
              className={styles.barra}
              data-g="barra"
              style={{ transform: `scaleX(${(atual + 1) / n})` }}
            />
          </div>
          <div className={styles.setas}>
            <button type="button" className={styles.seta} onClick={() => irPara(atualNaTela() - 1)} aria-label="Foto anterior">
              <Seta lado="esquerda" />
            </button>
            <button type="button" className={styles.seta} onClick={() => irPara(atualNaTela() + 1)} aria-label="Próxima foto">
              <Seta lado="direita" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
