/**
 * Como o pacote mensal de XMLs se organiza por dentro.
 *
 * Funções puras, sem banco e sem rede, porque a decisão que elas tomam é de
 * NOME — e nome errado no zip é o tipo de defeito que só aparece do lado do
 * contador, depois que ele já reclamou.
 *
 * Regras que valem a pena saber:
 *   - compra e venda em pastas separadas (é a primeira coisa que ele separa);
 *   - a CHAVE entra no nome porque é por ela que o sistema contábil importa;
 *   - a cancelada vai junto e avisa no nome: sem ela, sobra buraco na
 *     numeração e o contador tem que perguntar o que aconteceu.
 */

/**
 * As notas de um mês que têm XML para mandar. $1 = ano, $2 = mês.
 *
 * O recorte é por `created_at` comparado com o primeiro dia do mês, e a data
 * vira timestamptz no FUSO DA SESSÃO — que a aplicação abre em
 * America/Sao_Paulo (src/lib/pgTypes.js). É isso que mantém a nota das 23h30
 * do dia 31 dentro do mês dela, num servidor que roda em Berlim.
 *
 * Sem `xml_url` não entra: nota rejeitada não tem arquivo que exista na SEFAZ.
 * Cancelada entra — é ela que explica o pulo de numeração para o contador.
 */
export const SQL_NOTAS_DO_MES = `
  select n.ref, n.numero, n.serie, n.chave, n.status, n.operacao, n.xml_url,
         n.created_at, v.brand, v.model, v.placa
    from notas_fiscais n
    join vehicles v on v.id = n.vehicle_id
   where n.xml_url is not null
     and n.created_at >= make_date($1, $2, 1)
     and n.created_at <  make_date($1, $2, 1) + interval '1 month'
   order by n.operacao, n.numero::bigint nulls last, n.created_at
`;

/** Pastas válidas dentro do zip. Valor fora daqui cai em "outras". */
const PASTAS = new Set(["entrada", "saida", "devolucao"]);

/**
 * Nome (com pasta) do XML de uma nota dentro do pacote.
 *
 * O identificador é a chave; sem chave — nota que a SEFAZ ainda não autorizou —
 * cai na `ref`, que é única na tabela. O que não pode é dois arquivos com o
 * mesmo nome dentro do zip.
 */
export function nomeDoArquivo(nota) {
  const pasta = PASTAS.has(nota.operacao) ? nota.operacao : "outras";
  const numero = nota.numero ? String(nota.numero) : "sem-numero";
  const identificador = nota.chave || nota.ref;
  const cancelada = nota.status === "cancelada" ? "-CANCELADA" : "";
  return `${pasta}/NF-${numero}-${identificador}${cancelada}.xml`;
}

/** Nome do arquivo que a pessoa recebe: mês e ano na frente, sem ambiguidade. */
export function nomeDoZip(ano, mes) {
  return `xmls-vamaq-${ano}-${String(mes).padStart(2, "0")}.zip`;
}

/**
 * Bilhete que entra no zip quando algum XML não pôde ser baixado da Focus.
 *
 * Existe porque a alternativa era pior: mandar o pacote incompleto sem avisar,
 * e o contador descobrir a falta um mês depois — ou derrubar o download
 * inteiro por causa de uma nota. Devolve null quando não faltou nada.
 */
export function relatorioDeFaltando(faltando) {
  if (!faltando.length) return null;
  const linhas = faltando.map(
    (f) => `- NF ${f.numero || "sem número"} (${f.operacao}): ${f.motivo}`
  );
  return [
    `${faltando.length} nota(s) deste mês não puderam ser baixadas do emissor:`,
    "",
    ...linhas,
    "",
    "O resto do pacote está completo. Tente baixar de novo mais tarde; se",
    "continuar faltando, avise o suporte com este arquivo em mãos.",
    "",
  ].join("\n");
}
