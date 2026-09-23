/**
 * Quais veículos ainda precisam de nota de ENTRADA.
 *
 * A pergunta é por veículo E CICLO, nunca só por veículo: o carro que a loja
 * vendeu e recebeu de volta na troca é uma NOVA aquisição, com entrada própria
 * (ver docs/superpowers/specs/2026-09-17-retorno-ao-estoque-design.md). A
 * entrada autorizada do ciclo anterior continua no banco para sempre — ela é
 * documento fiscal, não rascunho — e casar só por `vehicle_id` faria esse
 * carro desaparecer do seletor "Emitir nota de entrada", que é o único caminho
 * da tela para /admin/fiscal/entrada/[id].
 *
 * É pura e mora fora do JSX de propósito: a tela de Notas Fiscais é um
 * componente React, e o `node --test` não importa JSX. As guardas equivalentes
 * ficaram sem teste justamente enquanto viveram dentro de telas — ver
 * `notaEntradaAtiva` em ./notas.js, que nasceu do mesmo aperto.
 */

// Nota viva = a que ocupa o lugar da entrada do ciclo. Cancelada ou com erro
// não ocupa: o carro volta a precisar de entrada, e é assim que o "refazer"
// da nota cancelada funciona.
const STATUS_ATIVO = ["processando", "autorizada"];

// `ciclo` é `not null default 1` em vehicles e em notas_fiscais, mas o
// fallback mantém os dois lados casando mesmo com dado vindo de fora do banco
// (mock, fixture) — um `undefined` de um lado contra um 1 do outro geraria
// chaves diferentes e traria de volta o bug que esta função fecha.
function chave(vehicleId, ciclo) {
  return `${vehicleId}|${ciclo ?? 1}`;
}

/**
 * @param veiculos linhas de `vehicles` (precisam trazer `id` e `ciclo` —
 *                 `readVehicles` traz, via SELECT_COLS)
 * @param notas    linhas de `notas_fiscais` (precisam trazer `vehicle_id`,
 *                 `operacao`, `status` e `ciclo` — `listNotas` traz, via n.*)
 */
export function veiculosSemEntrada(veiculos, notas) {
  const comEntrada = new Set(
    (notas || [])
      .filter((n) => n.operacao === "entrada" && STATUS_ATIVO.includes(n.status))
      .map((n) => chave(n.vehicle_id, n.ciclo))
  );
  return (veiculos || []).filter((v) => !comEntrada.has(chave(v.id, v.ciclo)));
}
