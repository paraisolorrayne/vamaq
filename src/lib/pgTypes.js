/**
 * Como o driver do Postgres entrega uma coluna `date`.
 *
 * O BUG QUE ISTO CONSERTA (17/08/2026): a Mayra cadastrou uma conta com
 * vencimento 15/09 e a lista mostrou 14/09. O banco estava certo o tempo todo
 * — quem errava era o caminho de volta.
 *
 * Uma coluna `date` do Postgres não tem hora nem fuso: "15 de setembro" e
 * pronto. O driver `pg`, ainda assim, a transforma num `Date` do JavaScript na
 * MEIA-NOITE LOCAL do servidor. A VPS roda em Europe/Berlin (UTC+2), então
 * `2026-09-15` virava `2026-09-15T00:00:00+02:00`, que ao ser serializado para
 * JSON (`toISOString()`) vira `2026-09-14T22:00:00.000Z`. A tela corta os dez
 * primeiros caracteres e mostra 14/09.
 *
 * Qualquer fuso a LESTE de Greenwich produz esse deslocamento — e a defesa não
 * pode ser lembrar de formatar em UTC em cada tela nova. Duas telas
 * (funcionários e fiscal) já tinham o remendo `timeZone: "UTC"`; quatro outras
 * não, e mostravam a data errada.
 *
 * A correção é não deixar virar `Date`: o tipo 1082 (`date`) passa a chegar
 * como a string `'YYYY-MM-DD'` que o Postgres já mandou. Cortar, comparar e
 * ordenar continuam funcionando (ISO ordena igual em texto), e as telas que
 * fazem `new Date(valor)` passam a parsear meia-noite UTC — que somado ao
 * `timeZone: "UTC"` delas dá a data certa.
 *
 * NÃO mexemos em `timestamptz` (1184): ali o instante é real e a conversão
 * para o fuso de quem olha é justamente o que se quer.
 */
import pg from "pg";

let aplicado = false;

/** Idempotente: `setTypeParser` é global no módulo pg, mas os dois pools chamam. */
export function usarDatasComoTexto() {
  if (aplicado) return;
  pg.types.setTypeParser(pg.types.builtins.DATE, (valor) => valor);
  aplicado = true;
}
