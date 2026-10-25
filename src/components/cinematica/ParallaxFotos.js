'use client';

import { useEffect } from 'react';

/**
 * Profundidade leve nas fotos: enquanto a página rola, cada `[data-parallax]`
 * desliza um pouco dentro do próprio quadro, no sentido contrário — a foto
 * parece estar atrás da moldura. Usado nos cards e na faixa da fachada do
 * acervo.
 *
 * O elemento marcado precisa ser uma camada MAIOR que a moldura (ver
 * .camadaProfunda no VehicleCard.module.css: 4% de sobra em cima e embaixo),
 * senão o deslize mostra a borda. Mexe só na propriedade `translate`, que se
 * soma ao `transform` do hover e ao `scale` da entrada sem brigar com eles.
 *
 * JS e não `animation-timeline`, pelo mesmo motivo do RevelaAoRolar: assim
 * funciona em todo navegador. Só as fotos na tela são recalculadas, uma vez
 * por quadro. Não anda com movimento reduzido nem com as animações pausadas.
 *
 * `chave`: muda quando a página ou os filtros trocam os cards.
 */
const CURSO = 3.5; // % da altura da camada, para cada lado

function pausadoNoBotao() {
  try {
    return localStorage.getItem('vamaq-movimento') === 'reduzido';
  } catch {
    return false;
  }
}

export default function ParallaxFotos({ chave }) {
  useEffect(() => {
    if (
      document.documentElement.dataset.cine === 'off' ||
      pausadoNoBotao() ||
      matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    ) {
      return undefined;
    }

    const naTela = new Set();
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (e.isIntersecting) naTela.add(e.target);
        else naTela.delete(e.target);
      }
      agendar();
    });
    const camadas = Array.from(document.querySelectorAll('[data-parallax]'));
    camadas.forEach((el) => io.observe(el));

    let quadro = 0;
    function atualizar() {
      quadro = 0;
      const meio = window.innerHeight / 2;
      for (const el of naTela) {
        const moldura = el.parentElement.getBoundingClientRect();
        // -1 com a moldura entrando por baixo, 0 no meio da tela, 1 saindo
        // por cima.
        const p = (meio - (moldura.top + moldura.height / 2)) / (meio + moldura.height / 2);
        el.style.translate = `0 ${(Math.max(-1, Math.min(1, p)) * CURSO).toFixed(2)}%`;
      }
    }
    function agendar() {
      if (!quadro) quadro = requestAnimationFrame(atualizar);
    }

    window.addEventListener('scroll', agendar, { passive: true });
    window.addEventListener('resize', agendar);
    agendar();

    return () => {
      io.disconnect();
      if (quadro) cancelAnimationFrame(quadro);
      window.removeEventListener('scroll', agendar);
      window.removeEventListener('resize', agendar);
      camadas.forEach((el) => el.style.removeProperty('translate'));
    };
  }, [chave]);

  return null;
}
