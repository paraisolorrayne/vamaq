/**
 * Decide, ANTES da primeira pintura, se a página abre com movimento.
 *
 * O CSS das cenas só monta o palco alto e fixo quando `<html data-cine="on">`.
 * Sem isto, a página pintaria a versão estática, hidrataria e só então
 * saltaria para a versão animada — o herói piscaria aceso antes de apagar.
 * Esperar o React para decidir é tarde demais; por isso é um script inline,
 * que roda enquanto o HTML ainda chega.
 *
 * Sem JavaScript nada disso roda e a página fica na versão estática, que é a
 * mesma informação com as fotos paradas. Navegando para cá por link interno
 * o script não roda (o React não executa script inserido no cliente) — aí
 * quem marca é o CinematicaMotion, ao montar.
 */
// A escolha feita no botão da página (localStorage) vale mais que a do
// sistema. A mesma regra está em lerPreferencia(), no CinematicaMotion.
const SCRIPT = `(function(){var r=matchMedia("(prefers-reduced-motion: reduce)").matches;try{var p=localStorage.getItem("vamaq-movimento");if(p)r=p==="reduzido"}catch(e){}document.documentElement.dataset.cine=r?"off":"on"})()`;

export default function MovimentoFlag() {
  return <script id="vamaq-movimento" dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
