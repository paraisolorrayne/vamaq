/**
 * Cláusula SQL da busca de cliente por nome: casa o termo inteiro OU o
 * primeiro token dele — sem o segundo caminho, um erro de digitação no
 * sobrenome ("Carlos Mendes" para achar "Carlos Mendez") devolve zero linhas
 * e a tela oferece cadastrar um duplicado (ver fix-duplicado-report.md,
 * item 1). "Carlos Mendes" passa a achar "Carlos Mendez" E "Carlos Eduardo
 * Mendes": mostra quem pode ser essa pessoa e deixa o humano decidir.
 *
 * Extraído de repo.js (que importa "@/lib/db" e por isso é intestável em
 * `node --test`, onde o alias "@/" não resolve) pelo mesmo motivo de
 * campos.js e doc.js: puro, sem I/O, import relativo — dá para provar contra
 * Postgres de verdade a partir do teste, sem duplicar a lógica nele.
 *
 * NÃO usa extensão do Postgres (pg_trgm e afins): exigiria `create extension`
 * em produção, e uma extensão indisponível na VPS quebraria a aplicação do
 * schema no deploy. SQL puro (like) resolve o caso nomeado.
 */

// Escapa os curingas do LIKE (% e _) e o próprio escape (\) antes de montar o
// padrão — sem isso, buscar por "%" ou "_" lista tudo em vez de nada.
// Copiado de src/lib/documentos.js:45 (mesma função, mesma razão de existir).
export function escapeCuringasLike(str) {
  return str.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * @param {string} termo texto digitado (não precisa vir aparado nem em
 *   minúsculas — a função normaliza).
 * @param {number} startIndex índice do próximo parâmetro posicional ($N) a
 *   usar — quem chama decide onde esta cláusula entra na lista de params.
 * @returns {{ clause: string, orderBy: string, params: string[], nextIndex: number } | null}
 *   `clause`: condição pronta para entrar num WHERE, casando `c.nome` contra
 *   o termo inteiro OU (quando o primeiro token tem 3+ caracteres) contra
 *   ele sozinho. Token curto (ex.: "de", "Jo") é ignorado — traria o cadastro
 *   inteiro. `orderBy`: expressão que vale 0 para quem casou o termo inteiro
 *   e 1 para quem casou só pelo token — usada para o resultado mais exato
 *   aparecer primeiro. `null` quando o termo é vazio.
 */
export function clausulaBuscaNome(termo, startIndex) {
  const termoNorm = String(termo || "").trim().toLowerCase();
  if (!termoNorm) return null;

  const params = [];
  let idx = startIndex;

  params.push(`%${escapeCuringasLike(termoNorm)}%`);
  const termoIdx = idx++;
  let clause = `lower(c.nome) like $${termoIdx}`;

  const primeiroToken = termoNorm.split(/\s+/)[0] || "";
  if (primeiroToken.length >= 3) {
    params.push(`%${escapeCuringasLike(primeiroToken)}%`);
    const tokenIdx = idx++;
    clause += ` or lower(c.nome) like $${tokenIdx}`;
  }

  const orderBy = `case when lower(c.nome) like $${termoIdx} then 0 else 1 end`;

  return { clause, orderBy, params, nextIndex: idx };
}

/**
 * Aplica o teto de resultados do seletor do CRM: corta `rows` em `limite`
 * itens e marca (`.mais`, no array devolvido) se havia mais candidatos do
 * que o teto — é o que vira "mostrando os N mais parecidos — refine a
 * busca" na tela (ver SeletorCliente.js). Puro: só corta um array já em
 * memória; quem chama (listClientes, em repo.js) decide buscar `limite + 1`
 * linhas do banco para esta função ter como saber se cortou de verdade.
 *
 * Sem `limite`, devolve `rows` sem tocar.
 */
export function aplicarLimite(rows, limite) {
  if (!limite) return rows;
  const cortado = rows.length > limite;
  const limitados = cortado ? rows.slice(0, limite) : rows;
  limitados.mais = cortado;
  return limitados;
}
