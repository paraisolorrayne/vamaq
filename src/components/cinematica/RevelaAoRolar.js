'use client';

import { useEffect } from 'react';

/**
 * Entrada leve dos blocos conforme a rolagem chega neles: sobem um pouco,
 * aparecem e, se tiverem foto, a foto recua de leve (o CSS está em
 * globals.css, procure por `data-revela`). Marcação:
 *   - `data-revela=""` num bloco;
 *   - `data-revela-grupo=""` num contêiner: cada filho entra sozinho, em
 *     cascata com os vizinhos que entram junto (uma fileira de cards).
 *
 * Por que não o `.revela` de sempre (CSS com animation-timeline)? Ele só
 * anima em Chrome/Edge e Safari 26+; em Safari mais antigo e no Firefox não
 * acontece nada. Aqui é IntersectionObserver + transição — todo navegador.
 *
 * Duas regras para não piscar nem sumir com conteúdo:
 *  - quem já está na tela quando a página monta fica como está (esconder
 *    para mostrar de novo seria um piscar);
 *  - sem JS, com movimento reduzido ou com as animações pausadas no botão,
 *    nada é escondido.
 *
 * `chave`: quando muda (página ou filtro do acervo), os cards novos são
 * procurados de novo; os que já apareceram não animam outra vez.
 */
// A escolha do botão "Pausar animações" vale aqui também, mesmo em página
// sem o botão (acervo): mesma chave do CinematicaMotion.
function pausadoNoBotao() {
  try {
    return localStorage.getItem('vamaq-movimento') === 'reduzido';
  } catch {
    return false;
  }
}

export default function RevelaAoRolar({ chave }) {
  useEffect(() => {
    if (
      document.documentElement.dataset.cine === 'off' ||
      pausadoNoBotao() ||
      matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    ) {
      return undefined;
    }

    document
      .querySelectorAll('[data-revela-grupo] > :not([data-revela])')
      .forEach((el) => el.setAttribute('data-revela', ''));

    const novos = Array.from(document.querySelectorAll('[data-revela=""]'));
    const abaixo = novos.filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.9);
    novos.forEach((el) => el.setAttribute('data-revela', abaixo.includes(el) ? 'espera' : 'feito'));

    const timers = [];
    const io = new IntersectionObserver(
      (entradas) => {
        // Quem entra no mesmo instante (uma fileira) entra em cascata.
        let ordem = 0;
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;
          const el = entrada.target;
          el.style.setProperty('--revela-i', String(ordem));
          el.setAttribute('data-revela', 'visivel');
          io.unobserve(el);
          // Terminada a entrada, sai a transição dela: ela substitui as do
          // próprio bloco (o zoom e a sombra do card no hover ficariam secos).
          timers.push(setTimeout(() => el.setAttribute('data-revela', 'feito'), 1500 + ordem * 90));
          ordem += 1;
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    abaixo.forEach((el) => io.observe(el));

    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
      document
        .querySelectorAll('[data-revela="visivel"]')
        .forEach((el) => el.setAttribute('data-revela', 'feito'));
      // Quem ficou esperando volta a ser "novo": a próxima procura o pega.
      document
        .querySelectorAll('[data-revela="espera"]')
        .forEach((el) => el.setAttribute('data-revela', ''));
    };
  }, [chave]);

  return null;
}
