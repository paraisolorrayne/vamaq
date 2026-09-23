/**
 * Quem aparece em cada seção da home. Puro — sem I/O e sem imports, para
 * rodar em `node --test`, onde o alias "@/" não resolve.
 *
 * A regra que isto existe para garantir: nenhum carro aparece em duas seções.
 * Em 21/09/2026 a curadoria ("Não é volume. É seleção.") e os recém-chegados
 * saíam da mesma lista, e o primeiro card de baixo repetia o carro de cima.
 */
const RECEM_CHEGADOS = 6;

function maisNovosPrimeiro(veiculos) {
  return [...veiculos].sort(
    (a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0)
  );
}

export function escolherVitrine(destaques, estoque) {
  const hero = destaques[0] || estoque[0] || null;
  const recentes = maisNovosPrimeiro(estoque.filter((v) => v.id !== hero?.id));

  // A curadoria fica com o mais recente e SAI da fila dos recém-chegados.
  // Com um carro só no estoque não há outro para mostrar: ela reaproveita o
  // herói, que é melhor que uma seção vazia.
  const [maisRecente, ...resto] = recentes;
  return {
    hero,
    narrativa: maisRecente || hero,
    recemChegados: resto.slice(0, RECEM_CHEGADOS),
  };
}
