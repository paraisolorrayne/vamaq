/**
 * "Hoje" no fuso de quem está olhando a tela.
 *
 * O BUG QUE ISTO CONSERTA: as telas do financeiro calculavam a data de hoje
 * com `new Date().toISOString().slice(0, 10)` — que é hoje em UTC, não aqui.
 * Depois das 21h em Uberlândia (UTC-3) o UTC já virou o dia seguinte, e duas
 * coisas quebravam ao mesmo tempo:
 *
 *   1. O formulário de conta a pagar nascia com a data de AMANHÃ;
 *   2. Uma conta que vence HOJE aparecia marcada como "Vencida", porque a
 *      comparação `due_date < hoje` usava o amanhã do UTC.
 *
 * É a mesma família do deslocamento de `date` no driver do Postgres (ver
 * src/lib/pgTypes.js), pelo outro lado: lá o servidor estava a leste, aqui o
 * usuário está a oeste.
 *
 * Roda no navegador, então "local" é o fuso do aparelho de quem usa — que é
 * exatamente o que a loja considera hoje.
 */

/** Data de hoje como 'YYYY-MM-DD', no fuso local. */
export function hojeISO() {
  return paraISO(new Date());
}

/** Um Date qualquer como 'YYYY-MM-DD', pelos componentes LOCAIS. */
export function paraISO(d) {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
