#!/usr/bin/env node
/**
 * Publicação inicial do estoque Vamaq Motors (Postgres).
 *
 * Insere as 8 fichas em `vehicles`:
 *   - 4 com fotos prontas  → published = true
 *   - 4 com fotos pendentes → published = false (ocultas no site)
 *
 * As fotos dos 4 prontos vivem em public/veiculos/<slug>/ e são gravadas em
 * `images` jsonb { main, gallery } com a capa indicada no CONTEUDO-ESTOQUE.md.
 *
 * Idempotente: ON CONFLICT (slug) DO NOTHING.
 *
 * Uso:
 *   DATABASE_URL=postgres://vamaq:senha@localhost:5432/vamaq node scripts/seed-estoque.mjs
 *   # ou:  node --env-file=.env.local scripts/seed-estoque.mjs
 */

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ Defina DATABASE_URL antes de rodar.');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_VEICULOS = path.join(__dirname, '..', 'public', 'veiculos');

const SPECS = (engine, acceleration, topSpeed, doors, seats) => ({
  engine, acceleration, topSpeed, doors, seats,
});

const VEHICLES = [
  {
    slug: 'porsche-cayenne-coupe-platinum-2022', folder: '01-cayenne-coupe-platinum-2022', primaryPrefix: '00000260',
    brand: 'Porsche', model: 'Cayenne Coupé Platinum Edition', year: 2022, body_type: 'SUV', color: 'Mahagoni Metálico',
    price: 586000, quilometragem: 20000, badge: 'Destaque', featured: true,
    fuel: 'Gasolina', transmission: 'Automático', power: '340 cv',
    specs: SPECS('3.0 V6 Turbo', '5,9 s (0-100km/h)', '243 km/h', 5, 5),
    published: true,
    description:
      'O Cayenne Coupé Platinum Edition é o que a Porsche faz quando decide misturar SUV, esportivo e exclusividade no mesmo carro. Esta unidade chega à Vamaq com apenas 20.000 km, full PPF aplicado (proteção total de pintura), pneus novos, IPVA 2026 quitado e pacote de opcionais completo de fábrica. A versão Platinum traz rodas dedicadas, acabamentos exclusivos em preto acetinado e um nível de presença que carro nenhum no segmento entrega. Procedência limpa, manutenção em dia, sem detalhes. É para quem não compra carro — escolhe.',
  },
  {
    slug: 'bmw-320i-m-sport-2022', folder: '02-bmw-320-msport-2022', primaryPrefix: '00000272',
    brand: 'BMW', model: '320i M Sport', year: 2022, body_type: 'Sedan', color: 'Azul Portimão',
    price: 224000, quilometragem: 53000, badge: null, featured: false,
    fuel: 'Gasolina', transmission: 'Automático', power: '184 cv',
    specs: SPECS('2.0 TwinPower Turbo', '7,1 s (0-100km/h)', '235 km/h', 4, 5),
    published: true,
    description:
      'A configuração mais desejada do 320 M Sport: Azul Portimão por fora, interior em couro conhaque por dentro. Combinação rara, daquelas que valorizam ao longo do tempo e que dificilmente você reencontra no mercado. Unidade 2022 com 53.000 km, PPF frontal aplicado, kit M Sport completo de fábrica e a dirigibilidade que consolidou o Série 3 como referência absoluta de sedan esportivo. Carro para quem entende que cor e acabamento não são detalhe — são o carro.',
  },
  {
    slug: 'dodge-ram-2500-rebel-2021', folder: '03-ram-2500-rebel-2021', primaryPrefix: '00000289',
    brand: 'Dodge', model: 'Ram 2500 Rebel', year: 2021, body_type: 'Picape', color: 'Cinza Granito',
    price: 285000, quilometragem: 129000, badge: null, featured: false,
    fuel: 'Diesel', transmission: 'Automático', power: '370 cv',
    specs: SPECS('6.7 Cummins Turbo Diesel', '', '', 4, 5),
    published: true,
    description:
      'Ram 2500 Rebel 2021: pickup íntegra, segundo dono, 129.000 km com revisões em dia e calçada com pneus BFGoodrich. Motor Cummins Turbo Diesel, tração 4x4, câmbio automático e o interior premium que diferencia a versão Rebel das demais. Presença imponente, capacidade real de trabalho pesado e o conforto de uma SUV de luxo. Não é uma picape comum — é o tipo de veículo que combina força bruta com luxo, e que poucos sabem entregar como a Ram faz.',
  },
  {
    slug: 'bmw-x4-m40i-2024', folder: '04-bmw-x4-m40i-2024', primaryPrefix: '00000469',
    brand: 'BMW', model: 'X4 M40i', year: 2024, body_type: 'SUV', color: 'Preta (Carbon Black)',
    price: 439000, quilometragem: 40000, badge: 'Destaque', featured: true,
    fuel: 'Gasolina', transmission: 'Automático', power: '387 cv',
    specs: SPECS('3.0 TwinPower Turbo (6 cilindros em linha)', '4,5 s (0-100km/h)', '250 km/h', 5, 5),
    published: true,
    description:
      'A X4 M40i é a definição de SUV esportivo da BMW: 387 cv, 0 a 100 km/h em 4,5 segundos, tração xDrive e o motor 3.0 TwinPower Turbo de 6 cilindros em linha — uma das melhores mecânicas já feitas pela marca. Esta unidade 2024 tem 40.000 km, revisões em concessionária, pacote M Performance de fábrica e o interior caramelo que valoriza o conjunto. Coupé de altura elevada, postura agressiva, conforto premium e os três modos de condução (Sport, Comfort, Eco Pro). Para quem quer um único carro que resolve tudo, sem abrir mão de absolutamente nada.',
  },
  {
    slug: 'bmw-m-sport-2025', folder: null, primaryPrefix: null,
    brand: 'BMW', model: 'M Sport', year: 2025, body_type: 'Sedan', color: 'Preta',
    price: 325000, quilometragem: 23000, badge: 'Novo', featured: false,
    fuel: 'Gasolina', transmission: 'Automático', power: 'A confirmar',
    specs: SPECS('', '', '', 4, 5),
    published: false,
    description:
      'BMW M Sport 2025 preta com interior claro: configuração de contraste impecável, daquelas que envelhecem bem. 23.000 km, todas as revisões feitas em concessionária e garantia de fábrica ainda vigente — praticamente um carro novo, com a vantagem de já estar pronto para sair rodando. Acabamento refinado, tecnologia BMW de última geração e o padrão esportivo que entrega presença em qualquer lugar. Para quem quer o pacote completo: performance, conforto, segurança e o nome certo no porta-malas.',
  },
  {
    slug: 'porsche-718-boxster-2020', folder: null, primaryPrefix: null,
    brand: 'Porsche', model: '718 Boxster', year: 2020, body_type: 'Conversível', color: 'Branca (capota vermelha)',
    price: 449000, quilometragem: 21000, badge: 'Destaque', featured: false,
    fuel: 'Gasolina', transmission: 'Automático', power: '300 cv',
    specs: SPECS('2.0 Boxer Turbo (motor central)', '5,1 s (0-100km/h)', '275 km/h', 2, 2),
    published: false,
    description:
      'Uma das configurações mais raras do 718 Boxster: carroceria branca com capota vermelha — combinação que a Porsche faz sob demanda e que aparece pouquíssimas vezes no mercado brasileiro. 21.000 km, estado de zero, rodas em preto brilhante, faróis em LED e o motor central turbo que define o que é equilíbrio em um esportivo. Conversível de motor central, distribuição de peso quase perfeita e aquela sensação que só Porsche entrega ao volante. Exclusividade que se vê de longe e se sente em cada curva.',
  },
  {
    slug: 'chery-tiggo-7-pro-hibrido', folder: null, primaryPrefix: null,
    brand: 'Chery', model: 'Tiggo 7 Pro Híbrido (MHEV)', year: 2024, body_type: 'SUV', color: 'A confirmar',
    price: 154900, quilometragem: 15500, badge: null, featured: false,
    fuel: 'Híbrido', transmission: 'Automático', power: '156 cv',
    specs: SPECS('1.5 Turbo MHEV', '', '', 5, 5),
    published: false,
    description:
      'Tiggo 7 Pro Híbrido com 15.500 km e ZERO detalhes: painel 100%, multimídia com Apple CarPlay e Android Auto, ar-condicionado digital dual zone, câmera 360°, carregador por indução, acabamento interno todo em couro, teto solar panorâmico e porta-malas de 475 L. Versão híbrida leve (MHEV) com motor 1.5 Turbo e câmbio automático CVT de 9 marchas, fabricado no Brasil e equipado com o pacote Max Drive completo: piloto adaptativo (ACC), assistente de faixa, frenagem automática de emergência, alerta de ponto cego e alerta de tráfego cruzado. SUV híbrido equipado como premium pelo preço de um intermediário. Não tem o que questionar.',
  },
  {
    slug: 'dodge-ram-2500-night-edition-2021', folder: null, primaryPrefix: null,
    brand: 'Dodge', model: 'Ram 2500 Night Edition', year: 2021, body_type: 'Picape', color: 'Preta',
    price: 339000, quilometragem: 92000, badge: 'Destaque', featured: false,
    fuel: 'Diesel', transmission: 'Automático', power: '370 cv',
    specs: SPECS('6.7 Cummins Turbo Diesel', '', '', 4, 5),
    published: false,
    description:
      'Ram 2500 Night Edition 2021: visual 100% blackout, full PPF (proteção total de pintura) e procedência garantida. 92.000 km, impecável de conservação. O Cummins Turbo Diesel entrega torque absurdo, conforto de SUV premium e a presença que só uma picape americana tem. Não é para qualquer um: é para quem quer trabalho pesado pela manhã, jantar no melhor restaurante à noite e a mesma picape resolvendo as duas pontas. Difícil encontrar nesse nível de conservação no mercado.',
  },
];

async function buildImages({ slug, folder, primaryPrefix }) {
  if (!folder) return { main: '', gallery: [] };
  let files;
  try {
    files = (await readdir(path.join(PUBLIC_VEICULOS, slug)))
      .filter((n) => /\.jpe?g$/i.test(n))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return { main: '', gallery: [] };
  }
  if (!files.length) return { main: '', gallery: [] };

  const idx = primaryPrefix ? files.findIndex((f) => f.startsWith(primaryPrefix)) : 0;
  if (idx > 0) {
    const [primary] = files.splice(idx, 1);
    files.unshift(primary);
  }
  const urls = files.map((f) => `/veiculos/${slug}/${f}`);
  return { main: urls[0], gallery: urls };
}

const { Pool } = pg;
const pool = new Pool({ connectionString: DATABASE_URL, max: 3 });

async function main() {
  console.log('Inserindo as 8 fichas...');
  let created = 0;
  for (const v of VEHICLES) {
    const images = await buildImages(v);
    const { rows } = await pool.query(
      `insert into vehicles (
         slug, brand, model, year, price, quilometragem,
         fuel, transmission, power, color, body_type, featured, badge,
         opcionais, blindagem, images, specs, description, published
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
         '[]'::jsonb, '{"blindado":false,"tipo":""}'::jsonb, $14::jsonb, $15::jsonb, $16, $17
       )
       on conflict (slug) do nothing
       returning id`,
      [
        v.slug, v.brand, v.model, v.year, v.price, v.quilometragem,
        v.fuel, v.transmission, v.power, v.color, v.body_type, v.featured, v.badge,
        JSON.stringify(images), JSON.stringify(v.specs), v.description, v.published,
      ]
    );
    if (rows.length) {
      created += 1;
      const n = images.gallery.length;
      console.log(`   + ${v.slug} (${v.published ? 'published' : 'draft'}${n ? `, ${n} foto(s)` : ''})`);
    } else {
      console.log(`   = ${v.slug} já existia — mantido.`);
    }
  }
  console.log(`\n✅ ${created} criado(s), ${VEHICLES.length - created} mantido(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error('❌ Erro no seed:', err.message);
  process.exit(1);
});
