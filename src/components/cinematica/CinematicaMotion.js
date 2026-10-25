'use client';

import { useEffect, useSyncExternalStore } from 'react';
import styles from './CinematicaMotion.module.css';

/**
 * Liga o movimento das cenas (data-cena="…") e mostra o botão de pausar.
 *
 * As cenas são HTML do servidor que já funciona parado; aqui só se descreve
 * como cada uma anda com a rolagem. O palco fixo é `position: sticky` no CSS
 * — o GSAP não fixa nada, só lê o progresso da trilha (scrub). Assim, se o
 * GSAP falhar, a página continua rolável e legível.
 *
 * O GSAP é importado aqui dentro, sob demanda e depois do primeiro quadro
 * (ver iniciar(), no efeito): não pesa no carregamento da página nem em quem
 * pediu movimento reduzido. Lenis ficou de fora de
 * propósito — o menu do celular e o lightbox travam a rolagem do body e a
 * rolagem suave brigaria com eles.
 */

const CHAVE = 'vamaq-movimento';
const EVENTO = 'vamaq-movimento';
// Quando o localStorage não está disponível (aba anônima com bloqueio, por
// exemplo), a escolha vale enquanto a página estiver aberta.
let memoria = null;

// Mesma regra do script inline (MovimentoFlag): a escolha feita no botão vale
// mais que a do sistema.
function lerPreferencia() {
  let salva = memoria;
  try {
    salva = localStorage.getItem(CHAVE) || memoria;
  } catch {}
  if (salva) return salva === 'reduzido' ? 'reduzido' : 'ligado';
  return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduzido' : 'ligado';
}

function assinar(avisar) {
  const sistema = matchMedia('(prefers-reduced-motion: reduce)');
  sistema.addEventListener('change', avisar);
  window.addEventListener('storage', avisar);
  window.addEventListener(EVENTO, avisar);
  return () => {
    sistema.removeEventListener('change', avisar);
    window.removeEventListener('storage', avisar);
    window.removeEventListener(EVENTO, avisar);
  };
}

function gravar(valor) {
  memoria = valor;
  try {
    localStorage.setItem(CHAVE, valor);
  } catch {}
  window.dispatchEvent(new Event(EVENTO));
}

const todos = (raiz, seletor) => Array.from(raiz.querySelectorAll(seletor));
const trilha = (trigger, extra = {}) => ({
  trigger,
  start: 'top top',
  end: 'bottom bottom',
  scrub: 0.6,
  invalidateOnRefresh: true,
  ...extra,
});
const entrada = { autoAlpha: 1, y: 0, duration: 0.28, ease: 'power2.out' };

// Cena 1. As duas aberturas começam sozinhas ao entrar (CSS) e a rolagem
// continua de onde a entrada parou; por último entram preço e botões.
//  - cortina: a faixa abre até a tela cheia e a câmera recua — só recorte e
//    escala, a foto fica nítida o tempo todo;
//  - luz: o facho cresce, a exposição sobe e a câmera se aproxima.
function montarReveal(gsap, largo) {
  const cena = document.querySelector('[data-cena="reveal"]');
  if (!cena) return;
  const um = (s) => cena.querySelector(s);
  const foto = um('[data-r="foto"]');
  const tl = gsap
    .timeline({ defaults: { ease: 'none' }, scrollTrigger: trilha(cena) })
    .fromTo(um('[data-r="dica"]'), { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.08 }, 0);

  if (cena.dataset.efeito === 'luz') {
    tl.fromTo(foto, { '--luz': '34%' }, { '--luz': '120%', duration: 0.5, ease: 'power1.inOut' }, 0)
      .fromTo(foto, { '--exp': 0 }, { '--exp': 1, duration: 0.5 }, 0.04)
      // xPercent/yPercent explícitos: o GSAP absorve o `translate` do CSS no
      // próprio transform e, no celular, perdia o -50% vertical — a foto
      // descia meia altura e caía em cima do texto. No computador a foto
      // termina nas bordas da tela; no celular para na largura da tela.
      .fromTo(
        foto,
        { xPercent: -50, yPercent: -50, scale: largo ? 0.84 : 0.82, y: 0 },
        {
          xPercent: -50,
          yPercent: -50,
          scale: () => (largo ? Math.max(1.08, (innerWidth / foto.offsetWidth) * 1.02) : 1),
          y: () => (largo ? -innerHeight * 0.06 : 0),
          duration: 0.72,
          ease: 'power1.inOut',
        },
        0
      );
  } else {
    // A escala vai na <img>, não no quadro: o quadro carrega o recorte (e,
    // no celular, a centralização do CSS, que o GSAP não deve tocar).
    // A foto desfocada de trás recua junto, para o carro fora de foco
    // continuar alinhado com o da faixa nítida.
    const camadas = [um('[data-r="img"]'), um('[data-r="desfoque"]')].filter(Boolean);
    tl.fromTo(foto, { '--fenda': '32%' }, { '--fenda': '0%', duration: 0.55, ease: 'power2.inOut' }, 0)
      .fromTo(camadas, { scale: 1.16 }, { scale: 1, duration: 0.72, ease: 'power1.out' }, 0);
  }

  tl.fromTo(um('[data-r="info"]'), { autoAlpha: 0, y: 48 }, { ...entrada, duration: 0.18 }, 0.56)
    // Segura o quadro final antes de a página seguir.
    .to({}, { duration: 0.2 });
}

// Cena 2: cada placa entra cobrindo a anterior de baixo para cima; dentro
// dela, três velocidades — marca ao fundo, foto no meio, detalhes na frente.
function montarVitrine(gsap, largo) {
  const ENTRADA = 0.45;
  todos(document, '[data-cena="vitrine"]').forEach((cena) => {
    const placas = todos(cena, '[data-v="placa"]');
    if (!placas.length) return;
    const atual = cena.querySelector('[data-v="atual"]');
    const n = placas.length;

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: trilha(cena),
      onUpdate() {
        if (!atual) return;
        const i = Math.min(n - 1, Math.max(0, Math.floor(this.time() + ENTRADA / 2)));
        atual.textContent = String(i + 1).padStart(2, '0');
      },
    });

    placas.forEach((placa, i) => {
      const um = (s) => placa.querySelector(s);
      const inicio = i === 0 ? 0 : i - ENTRADA;
      const duracao = 1 + ENTRADA;

      if (i > 0) {
        tl.fromTo(
          placa,
          { clipPath: 'inset(100% 0% 0% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: ENTRADA, ease: 'power2.inOut' },
          inicio
        );
        // O texto entra junto com a cortina, que sobe de baixo: esperar o fim
        // dela deixava a faixa do texto vazia no meio da troca.
        tl.fromTo(um('[data-v="texto"]'), { autoAlpha: 0, y: 40 }, entrada, inicio + 0.12);
      }
      // yPercent pelo mesmo motivo da foto da cena 1 (centralização do CSS).
      tl.fromTo(
        um('[data-v="fundo"]'),
        { xPercent: 10, yPercent: -50 },
        { xPercent: -18, yPercent: -50, duration: duracao },
        inicio
      );
      tl.fromTo(
        todos(placa, '[data-v="angulo"], [data-v="angulo-b"]'),
        { scale: 1.14 },
        { scale: 1, duration: duracao },
        inicio
      );
      const outroAngulo = um('[data-v="angulo-b"]');
      // Cortina da direita para a esquerda, não fusão: a segunda foto pode ser
      // qualquer uma (no Civic é o câmbio) e, fundida, o interior aparecia
      // como fantasma sobre o carro no meio da rolagem.
      if (outroAngulo) {
        tl.fromTo(
          outroAngulo,
          { clipPath: 'inset(0% 0% 0% 100%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.3, ease: 'power2.inOut' },
          i + 0.3
        );
      }
      if (largo) {
        todos(placa, '[data-v="detalhe"]').forEach((d, k) => {
          tl.fromTo(
            d,
            // Curso curto o bastante para não subir sobre o contador.
            { y: () => innerHeight * (k ? 0.12 : 0.16) },
            { y: () => -innerHeight * (k ? 0.08 : 0.05), duration: duracao },
            inicio
          );
        });
      }
    });
    tl.to({}, { duration: 0.25 });
  });
}

// Apresentação: a transição do topo da ficha para a galeria. Enquanto a
// galeria sobe, o conteúdo do topo desce mais devagar que a página e encolhe
// um pouco — profundidade, sem apagar nada (foto esmaecida é o "desfoque"
// que a Lorrayne vetou).
function montarSaidaHero(gsap) {
  const hero = document.querySelector('[data-secao="hero"]');
  const conteudo = hero?.querySelector('[data-secao-conteudo]');
  if (!conteudo) return;
  // Os FILHOS, não o bloco: a ficha tem um degradê branco (.hero::after,
  // z-index 1) entre o fundo e o conteúdo, que fica por cima graças ao
  // z-index 2 de texto e foto. Com transform no bloco, ele vira camada
  // própria abaixo do degradê e o topo inteiro aparecia esbranquiçado.
  gsap.fromTo(
    Array.from(conteudo.children),
    { y: 0, scale: 1 },
    {
      y: () => Math.min(140, hero.offsetHeight * 0.18),
      scale: 0.96,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true },
    }
  );
}

// Galeria da apresentação: a rolagem vertical leva a faixa para o lado. Cada
// foto cresce ao passar pelo meio e a imagem desliza dentro do quadro mais
// devagar que a faixa (profundidade). Nenhum filtro: a foto fica sempre
// nítida e com a cor do cadastro.
function montarGaleria(gsap) {
  todos(document, '[data-cena="galeria"]').forEach((secao) => {
    const fila = secao.querySelector('[data-g="fila"]');
    const itens = todos(secao, '[data-g="item"]');
    if (!fila || itens.length < 2) return;
    const atual = secao.querySelector('[data-g="atual"]');
    const barra = secao.querySelector('[data-g="barra"]');
    const n = itens.length;

    const andar = gsap.fromTo(
      fila,
      { x: 0 },
      {
        x: () => -Math.max(0, fila.scrollWidth - document.documentElement.clientWidth),
        ease: 'none',
        scrollTrigger: trilha(secao, {
          onUpdate(st) {
            const i = Math.round(st.progress * (n - 1));
            if (atual) atual.textContent = String(i + 1).padStart(2, '0');
            if (barra) gsap.set(barra, { scaleX: (i + 1) / n });
          },
        }),
      }
    );

    itens.forEach((item) => {
      const img = item.querySelector('[data-g="img"]');
      const passagem = () => ({
        trigger: item,
        containerAnimation: andar,
        start: 'left right',
        end: 'right left',
        scrub: true,
      });
      gsap
        .timeline({ scrollTrigger: passagem() })
        .fromTo(item, { scale: 0.86 }, { scale: 1, ease: 'power1.out' })
        .to(item, { scale: 0.86, ease: 'power1.in' });
      // 1.18 de escala dá folga para o deslize de ±7% sem mostrar borda.
      if (img) {
        gsap.fromTo(
          img,
          { scale: 1.18, xPercent: 7 },
          { scale: 1.18, xPercent: -7, ease: 'none', scrollTrigger: passagem() }
        );
      }
    });
  });
}

// Cena 4: a fachada acende, corta pelo branco para os faróis, corta de novo
// para o salão. Corte, nunca fusão — ver CenaBoutique.js.
function montarBoutique(gsap) {
  const cena = document.querySelector('[data-cena="boutique"]');
  if (!cena) return;
  const batidas = todos(cena, '[data-b="batida"]');
  const veu = cena.querySelector('[data-b="veu"]');
  if (batidas.length < 3 || !veu) return;
  const img = (i) => batidas[i].querySelector('[data-b="img"]');
  const legenda = (i) => batidas[i].querySelector('[data-b="legenda"]');

  gsap.set(batidas.slice(1), { autoAlpha: 0 });
  const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: trilha(cena) });
  const corte = (de, para, em) => {
    tl.to(veu, { opacity: 1, duration: 0.2, ease: 'power1.in' }, em)
      .set(batidas[de], { autoAlpha: 0 }, em + 0.2)
      .set(batidas[para], { autoAlpha: 1 }, em + 0.2)
      .to(veu, { opacity: 0, duration: 0.25, ease: 'power1.out' }, em + 0.2);
  };

  tl.fromTo(img(0), { '--exp': 0 }, { '--exp': 1, duration: 1, ease: 'power1.inOut' }, 0)
    .fromTo(img(0), { scale: 1.12 }, { scale: 1, duration: 1.5 }, 0)
    .fromTo(legenda(0), { autoAlpha: 0, y: 40 }, entrada, 0.65);
  corte(0, 1, 1.5);
  tl.fromTo(img(1), { scale: 1 }, { scale: 1.12, duration: 1.3 }, 1.7)
    .fromTo(legenda(1), { autoAlpha: 0, y: 40 }, entrada, 1.85);
  corte(1, 2, 3);
  tl.fromTo(img(2), { scale: 1.16 }, { scale: 1, duration: 1.2 }, 3.2)
    .fromTo(legenda(2), { autoAlpha: 0, y: 40 }, entrada, 3.35)
    .to({}, { duration: 0.5 });
}

// `emLinha`: o botão entra no fluxo do bloco em vez de fixo na tela — para
// páginas em que só um trecho anima (a galeria da apresentação do carro);
// fixo, ele seguiria a ficha inteira sem ter o que pausar.
export default function CinematicaMotion({ emLinha = false }) {
  const preferencia = useSyncExternalStore(assinar, lerPreferencia, () => 'ligado');
  const ligado = preferencia === 'ligado';

  useEffect(() => {
    const raiz = document.documentElement;
    raiz.dataset.cine = ligado ? 'on' : 'off';
    if (!ligado) return undefined;

    let cancelado = false;
    let desfazer = () => {};
    const montar = ([{ gsap }, { ScrollTrigger }]) => {
      if (cancelado) return;
      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.config({ ignoreMobileResize: true });

      const mm = gsap.matchMedia();
      mm.add({ largo: '(min-width: 900px)', estreito: '(max-width: 899.98px)' }, (ctx) => {
        const { largo } = ctx.conditions;
        montarReveal(gsap, largo);
        montarVitrine(gsap, largo);
        montarBoutique(gsap, largo);
        montarGaleria(gsap);
        montarSaidaHero(gsap);
      });
      raiz.dataset.cinePronto = '';

      // Fontes e fotos que chegam depois mudam a altura dos blocos sem palco
      // fixo (ficha, par); as posições de início e fim precisam ser refeitas.
      const recalcular = () => ScrollTrigger.refresh();
      if (document.readyState === 'complete') requestAnimationFrame(recalcular);
      else window.addEventListener('load', recalcular, { once: true });
      document.fonts?.ready.then(() => !cancelado && recalcular());

      desfazer = () => {
        window.removeEventListener('load', recalcular);
        mm.revert();
        delete raiz.dataset.cinePronto;
      };
    };

    // O GSAP não pinta o primeiro quadro — o CSS já abre cada cena no estado
    // inicial —, então ele espera o navegador ficar livre ou a primeira
    // rolagem/toque, o que vier antes. Importado junto com a hidratação, ele
    // disputava a CPU com a foto do destaque: no Lighthouse do celular o LCP
    // simulado ia de 2,8 s (home atual) para 3,6 s. O prazo de 2 s fica antes
    // da "segurança" de 3,5 s do CSS, que acende a cena se o JS não vier.
    const GATILHOS = ['scroll', 'pointerdown', 'touchstart', 'keydown'];
    const ocioso = typeof window.requestIdleCallback === 'function';
    let iniciado = false;
    let espera = 0;
    const soltar = () => {
      GATILHOS.forEach((e) => window.removeEventListener(e, iniciar));
      if (ocioso) window.cancelIdleCallback(espera);
      else clearTimeout(espera);
    };
    function iniciar() {
      if (iniciado) return;
      iniciado = true;
      soltar();
      Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(montar);
    }
    GATILHOS.forEach((e) => window.addEventListener(e, iniciar, { passive: true }));
    espera = ocioso ? window.requestIdleCallback(iniciar, { timeout: 2000 }) : setTimeout(iniciar, 1200);

    return () => {
      cancelado = true;
      soltar();
      desfazer();
    };
  }, [ligado]);

  return (
    <button
      type="button"
      className={`${styles.botao} ${emLinha ? styles.emLinha : ''}`}
      aria-pressed={!ligado}
      onClick={() => gravar(ligado ? 'reduzido' : 'ligado')}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
        {ligado ? <path d="M4 3h3v10H4zM9 3h3v10H9z" /> : <path d="M5 3l8 5-8 5z" />}
      </svg>
      <span className={styles.rotulo}>{ligado ? 'Pausar animações' : 'Ativar animações'}</span>
    </button>
  );
}
