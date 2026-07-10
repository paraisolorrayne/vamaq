#!/usr/bin/env node
/**
 * Correção dos preços gravados errado no estoque (Postgres).
 *
 * Duas anomalias corrigidas:
 *   1. Preço "engolido" pelo input antigo: quem digitou "299.000" gravou 299.
 *      → Regra A: price < 1000 vira price × 1000 (299 → 299000).
 *   2. Valor exato da tabela FIPE aplicado sem arredondar (ex.: 214996).
 *      → Regra B: price que não é múltiplo de 10 (final 6, 3, centavos...)
 *        é arredondado ao milhar (214996 → 215000). Preços humanos de
 *        vitrine (299.900, 89.990) terminam em 0 e não são tocados.
 *
 * Por padrão roda em MODO SIMULAÇÃO (dry-run): só mostra o que faria.
 * Para gravar de fato, rode com --apply.
 *
 * Também lista os veículos com published = false — eles não aparecem no
 * site (/acervo) até serem publicados no admin.
 *
 * Uso (na VPS, na pasta do projeto):
 *   node scripts/fix-precos.mjs                     # simulação
 *   node scripts/fix-precos.mjs --apply             # aplica as correções
 *   # se DATABASE_URL não estiver no ambiente:
 *   DATABASE_URL=postgres://... node scripts/fix-precos.mjs
 *   # ou: node --env-file=.env.local scripts/fix-precos.mjs
 */

import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ Defina DATABASE_URL antes de rodar.');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');

const fmt = (n) =>
  n === null || n === undefined
    ? 'Sob Consulta'
    : 'R$ ' + Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

function proposeFix(price) {
  if (price === null || price === undefined) return null;
  const n = Number(price);
  // Regra A: "299.000" digitado virou 299 — nenhum carro da loja custa < R$ 1.000
  if (n > 0 && n < 1000) {
    return { fixed: Math.round(n * 1000), rule: 'A: preço engolido (×1000)' };
  }
  // Regra B: valor FIPE cru (não múltiplo de 10) — arredonda ao milhar
  if (n >= 1000 && (!Number.isInteger(n) || n % 10 !== 0)) {
    return { fixed: Math.round(n / 1000) * 1000, rule: 'B: valor FIPE quebrado (milhar)' };
  }
  return null;
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });

try {
  const { rows } = await pool.query(
    `select id, slug, brand, model, year, price, published
       from vehicles order by created_at`
  );

  if (!rows.length) {
    console.log('Nenhum veículo na tabela.');
    process.exit(0);
  }

  console.log(`${rows.length} veículos no banco.\n`);
  console.log('── Preços ──────────────────────────────────────────────');

  const fixes = [];
  for (const v of rows) {
    const nome = `${v.brand} ${v.model} ${v.year}`;
    const fix = proposeFix(v.price);
    if (fix) {
      fixes.push({ ...v, ...fix });
      console.log(
        `⚠️  ${nome}\n    ${fmt(v.price)}  →  ${fmt(fix.fixed)}   [regra ${fix.rule}]`
      );
    } else {
      console.log(`✓  ${nome} — ${fmt(v.price)}`);
    }
  }

  if (!fixes.length) {
    console.log('\nNenhum preço suspeito encontrado. 🎉');
  } else if (!APPLY) {
    console.log(
      `\n${fixes.length} preço(s) a corrigir. MODO SIMULAÇÃO — nada foi alterado.` +
        `\nConfira a lista acima e rode de novo com --apply para gravar.`
    );
  } else {
    const client = await pool.connect();
    try {
      await client.query('begin');
      for (const f of fixes) {
        await client.query(
          `update vehicles set price = $1, updated_at = now() where id = $2`,
          [f.fixed, f.id]
        );
      }
      await client.query('commit');
      console.log(`\n✅ ${fixes.length} preço(s) corrigido(s).`);
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  const ocultos = rows.filter((v) => !v.published);
  console.log('\n── Publicação (visibilidade no site) ───────────────────');
  if (!ocultos.length) {
    console.log('Todos os veículos estão publicados (aparecem no /acervo).');
  } else {
    console.log(
      `${ocultos.length} veículo(s) com published = false — NÃO aparecem no site:`
    );
    for (const v of ocultos) {
      console.log(`   🙈 ${v.brand} ${v.model} ${v.year}  (${v.slug})`);
    }
    console.log(
      'Para publicar: edite o veículo no admin e marque "Publicado no site".'
    );
  }
} finally {
  await pool.end();
}
