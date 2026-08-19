#!/usr/bin/env node
/**
 * Uniformiza a grafia das marcas já gravadas em `vehicles.brand`.
 *
 * A partir de 19/08/2026 o cadastro normaliza na gravação
 * (src/lib/marcaVeiculo.js), mas o que já estava no banco continua como foi
 * digitado: `AUDI`, `Audi` e `Audi ` conviviam, e a lista de filtros do acervo
 * mostrava 17 marcas onde existem 13.
 *
 * NÃO MEXE NO SLUG: ele é gerado na criação do veículo e é o endereço público
 * da página do carro. Reescrevê-lo quebraria todo link já compartilhado.
 *
 * Uso:
 *   node --env-file=.env.local scripts/normalizar-marcas.mjs           # mostra
 *   node --env-file=.env.local scripts/normalizar-marcas.mjs --aplicar # grava
 */
import pg from "pg";
import { normalizaMarca } from "../src/lib/marcaVeiculo.js";

const aplicar = process.argv.includes("--aplicar");
const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error("DATABASE_URL ausente (rode com --env-file=.env.local).");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const { rows } = await pool.query(`select id, brand from vehicles order by brand`);

const mudancas = rows
  .map((v) => ({ ...v, novo: normalizaMarca(v.brand) }))
  .filter((v) => v.novo !== v.brand);

const antes = new Set(rows.map((v) => v.brand));
const depois = new Set(rows.map((v) => normalizaMarca(v.brand)));

console.log(`veículos: ${rows.length}`);
console.log(`marcas distintas hoje: ${antes.size}  →  depois: ${depois.size}`);
console.log(`linhas a mudar: ${mudancas.length}\n`);

const porPar = new Map();
for (const m of mudancas) {
  const k = `${JSON.stringify(m.brand)} → ${JSON.stringify(m.novo)}`;
  porPar.set(k, (porPar.get(k) || 0) + 1);
}
for (const [par, n] of [...porPar].sort()) console.log(`  ${par}  (${n})`);

if (!aplicar) {
  console.log("\nNada foi alterado. Rode com --aplicar para gravar.");
  await pool.end();
  process.exit(0);
}

let feitas = 0;
for (const m of mudancas) {
  await pool.query(`update vehicles set brand = $2 where id = $1`, [m.id, m.novo]);
  feitas += 1;
}
const { rows: conferencia } = await pool.query(
  `select count(distinct brand)::int as marcas from vehicles`
);
console.log(`\n${feitas} linhas atualizadas. Marcas distintas agora: ${conferencia[0].marcas}`);
await pool.end();
