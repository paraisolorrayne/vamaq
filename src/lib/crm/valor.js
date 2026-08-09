// Normalização do campo "valor" das oportunidades do CRM — extraído à parte
// para ser testável sem banco (o repositório em oportunidades.js importa
// @/lib/db, que não resolve em `node --test`).
//
// `parseValorBR` (src/lib/money.js) é pura (sem imports), então é importada
// aqui por caminho relativo com extensão — o alias @/ não resolve fora do
// bundler do Next.
import { parseValorBR } from "../money.js";

// Converte o valor bruto do formulário (formato brasileiro, ex.: "180.000,00")
// no número que vai para a coluna `numeric` do Postgres.
//
// `valor` é campo opcional: vazio, null e undefined viram null, nunca 0.
// Entrada que não dá para interpretar também vira null — nunca NaN, que o
// Postgres aceita em silêncio e grava errado.
export function valorDaOportunidade(bruto) {
  if (bruto === "" || bruto == null) return null;
  const n = parseValorBR(bruto);
  return Number.isNaN(n) ? null : n;
}
