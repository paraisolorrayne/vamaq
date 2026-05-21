#!/usr/bin/env node
/**
 * Publicação inicial do estoque Vamaq Motors — Postgres "puro".
 *
 * Passo 1 — insere as 8 fichas em `vehicles`:
 *           - 4 com fotos prontas (status=published)
 *           - 4 com fotos pendentes do Mateus (status=draft)
 * Passo 2 — para os 4 com fotos, insere as linhas em `vehicle_images`
 *           apontando para os arquivos estáticos em public/veiculos/<slug>/.
 *
 * Idempotente:
 *   - vehicles: ON CONFLICT (slug) DO NOTHING.
 *   - vehicle_images: se o veículo já tem imagens, pula.
 *
 * Pré-requisitos:
 *   - Schema aplicado (db/schema.sql).
 *   - DATABASE_URL apontando para o Postgres.
 *
 * Uso (raiz do projeto):
 *   DATABASE_URL=postgres://vamaq:senha@localhost:5432/vamaq \
 *     node scripts/seed-estoque.mjs
 *
 *   # ou, lendo do .env.local:
 *   node --env-file=.env.local scripts/seed-estoque.mjs
 */

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    '❌ Defina DATABASE_URL antes de rodar.\n' +
      '   Ex.: DATABASE_URL=postgres://vamaq:senha@localhost:5432/vamaq node scripts/seed-estoque.mjs'
  );
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_VEICULOS = path.join(__dirname, '..', 'public', 'veiculos');

const VEHICLES = [
  {
    slug: 'porsche-cayenne-coupe-platinum-2022',
    brand: 'Porsche', model: 'Cayenne Coupé Platinum Edition', year: 2022,
    body_type: 'SUV', color: 'Mahagoni Metálico',
    price: 586000, mileage: 20000, badge: 'Destaque', featured: true,
    fuel: 'Gasolina', transmission: 'Automático', power: '340 cv',
    spec_engine: '3.0 V6 Turbo', spec_acceleration: '5,9 s (0-100km/h)',
    spec_top_speed: '243 km/h', spec_doors: 5, spec_seats: 5,
    description:
      'O Cayenne Coupé Platinum Edition é o que a Porsche faz quando decide misturar SUV, esportivo e exclusividade no mesmo carro. Esta unidade chega à Vamaq com apenas 20.000 km, full PPF aplicado (proteção total de pintura), pneus novos, IPVA 2026 quitado e pacote de opcionais completo de fábrica. A versão Platinum traz rodas dedicadas, acabamentos exclusivos em preto acetinado e um nível de presença que carro nenhum no segmento entrega. Procedência limpa, manutenção em dia, sem detalhes. É para quem não compra carro — escolhe.',
    status: 'published', publishNow: true,
  },
  {
    slug: 'bmw-320i-m-sport-2022',
    brand: 'BMW', model: '320i M Sport', year: 2022,
    body_type: 'Sedan', color: 'Azul Portimão',
    price: 224000, mileage: 53000, badge: null, featured: false,
    fuel: 'Gasolina', transmission: 'Automático', power: '184 cv',
    spec_engine: '2.0 TwinPower Turbo', spec_acceleration: '7,1 s (0-100km/h)',
    spec_top_speed: '235 km/h', spec_doors: 4, spec_seats: 5,
    description:
      'A configuração mais desejada do 320 M Sport: Azul Portimão por fora, interior em couro conhaque por dentro. Combinação rara, daquelas que valorizam ao longo do tempo e que dificilmente você reencontra no mercado. Unidade 2022 com 53.000 km, PPF frontal aplicado, kit M Sport completo de fábrica e a dirigibilidade que consolidou o Série 3 como referência absoluta de sedan esportivo. Carro para quem entende que cor e acabamento não são detalhe — são o carro.',
    status: 'published', publishNow: true,
  },
  {
    slug: 'dodge-ram-2500-rebel-2021',
    brand: 'Dodge', model: 'Ram 2500 Rebel', year: 2021,
    body_type: 'Pickup', color: 'Cinza Granito',
    price: 285000, mileage: 129000, badge: null, featured: false,
    fuel: 'Diesel', transmission: 'Automático', power: '370 cv',
    spec_engine: '6.7 Cummins Turbo Diesel', spec_acceleration: null,
    spec_top_speed: null, spec_doors: 4, spec_seats: 5,
    description:
      'Ram 2500 Rebel 2021: pickup íntegra, segundo dono, 129.000 km com revisões em dia e calçada com pneus BFGoodrich. Motor Cummins Turbo Diesel, tração 4x4, câmbio automático e o interior premium que diferencia a versão Rebel das demais. Presença imponente, capacidade real de trabalho pesado e o conforto de uma SUV de luxo. Não é uma picape comum — é o tipo de veículo que combina força bruta com luxo, e que poucos sabem entregar como a Ram faz.',
    status: 'published', publishNow: true,
  },
  {
    slug: 'bmw-x4-m40i-2024',
    brand: 'BMW', model: 'X4 M40i', year: 2024,
    body_type: 'SUV', color: 'Preta (Carbon Black)',
    price: 439000, mileage: 40000, badge: 'Destaque', featured: true,
    fuel: 'Gasolina', transmission: 'Automático', power: '387 cv',
    spec_engine: '3.0 TwinPower Turbo (6 cilindros em linha)',
    spec_acceleration: '4,5 s (0-100km/h)', spec_top_speed: '250 km/h',
    spec_doors: 5, spec_seats: 5,
    description:
      'A X4 M40i é a definição de SUV esportivo da BMW: 387 cv, 0 a 100 km/h em 4,5 segundos, tração xDrive e o motor 3.0 TwinPower Turbo de 6 cilindros em linha — uma das melhores mecânicas já feitas pela marca. Esta unidade 2024 tem 40.000 km, revisões em concessionária, pacote M Performance de fábrica e o interior caramelo que valoriza o conjunto. Coupé de altura elevada, postura agressiva, conforto premium e os três modos de condução (Sport, Comfort, Eco Pro). Para quem quer um único carro que resolve tudo, sem abrir mão de absolutamente nada.',
    status: 'published', publishNow: true,
  },
  {
    slug: 'bmw-m-sport-2025',
    brand: 'BMW', model: 'M Sport', year: 2025,
    body_type: 'Sedan', color: 'Preta',
    price: 325000, mileage: 23000, badge: 'Novo', featured: false,
    fuel: 'Gasolina', transmission: 'Automático', power: 'A confirmar',
    spec_engine: null, spec_acceleration: null, spec_top_speed: null,
    spec_doors: null, spec_seats: null,
    description:
      'BMW M Sport 2025 preta com interior claro: configuração de contraste impecável, daquelas que envelhecem bem. 23.000 km, todas as revisões feitas em concessionária e garantia de fábrica ainda vigente — praticamente um carro novo, com a vantagem de já estar pronto para sair rodando. Acabamento refinado, tecnologia BMW de última geração e o padrão esportivo que entrega presença em qualquer lugar. Para quem quer o pacote completo: performance, conforto, segurança e o nome certo no porta-malas.',
    status: 'draft', publishNow: false,
  },
  {
    slug: 'porsche-718-boxster-2020',
    brand: 'Porsche', model: '718 Boxster', year: 2020,
    body_type: 'Conversível', color: 'Branca (capota vermelha)',
    price: 449000, mileage: 21000, badge: 'Destaque', featured: true,
    fuel: 'Gasolina', transmission: 'Automático', power: '300 cv',
    spec_engine: '2.0 Boxer Turbo (motor central)',
    spec_acceleration: '5,1 s (0-100km/h)', spec_top_speed: '275 km/h',
    spec_doors: 2, spec_seats: 2,
    description:
      'Uma das configurações mais raras do 718 Boxster: carroceria branca com capota vermelha — combinação que a Porsche faz sob demanda e que aparece pouquíssimas vezes no mercado brasileiro. 21.000 km, estado de zero, rodas em preto brilhante, faróis em LED e o motor central turbo que define o que é equilíbrio em um esportivo. Conversível de motor central, distribuição de peso quase perfeita e aquela sensação que só Porsche entrega ao volante. Exclusividade que se vê de longe e se sente em cada curva.',
    status: 'draft', publishNow: false,
  },
  {
    slug: 'chery-tiggo-7-pro-hibrido',
    brand: 'Chery', model: 'Tiggo 7 Pro Híbrido (MHEV)', year: 2024,
    body_type: 'SUV', color: 'A confirmar',
    price: 154900, mileage: 15500, badge: null, featured: false,
    fuel: 'Híbrido', transmission: 'Automático', power: '156 cv',
    spec_engine: '1.5 Turbo MHEV', spec_acceleration: null,
    spec_top_speed: null, spec_doors: 5, spec_seats: 5,
    description:
      'Tiggo 7 Pro Híbrido com 15.500 km e ZERO detalhes: painel 100%, multimídia com Apple CarPlay e Android Auto, ar-condicionado digital dual zone, câmera 360°, carregador por indução, acabamento interno todo em couro, teto solar panorâmico e porta-malas de 475 L. Versão híbrida leve (MHEV) com motor 1.5 Turbo e câmbio automático CVT de 9 marchas, fabricado no Brasil e equipado com o pacote Max Drive completo: piloto adaptativo (ACC), assistente de faixa, frenagem automática de emergência, alerta de ponto cego e alerta de tráfego cruzado. SUV híbrido equipado como premium pelo preço de um intermediário. Não tem o que questionar.',
    status: 'draft', publishNow: false,
  },
  {
    slug: 'dodge-ram-2500-night-edition-2021',
    brand: 'Dodge', model: 'Ram 2500 Night Edition', year: 2021,
    body_type: 'Pickup', color: 'Preta',
    price: 339000, mileage: 92000, badge: 'Destaque', featured: false,
    fuel: 'Diesel', transmission: 'Automático', power: '370 cv',
    spec_engine: '6.7 Cummins Turbo Diesel', spec_acceleration: null,
    spec_top_speed: null, spec_doors: 4, spec_seats: 5,
    description:
      'Ram 2500 Night Edition 2021: visual 100% blackout, full PPF (proteção total de pintura) e procedência garantida. 92.000 km, impecável de conservação. O Cummins Turbo Diesel entrega torque absurdo, conforto de SUV premium e a presença que só uma picape americana tem. Não é para qualquer um: é para quem quer trabalho pesado pela manhã, jantar no melhor restaurante à noite e a mesma picape resolvendo as duas pontas. Difícil encontrar nesse nível de conservação no mercado.',
    status: 'draft', publishNow: false,
  },
];

// slug → prefixo do arquivo da foto-capa (CONTEUDO-ESTOQUE.md).
const PRIMARY_PREFIX = {
  'porsche-cayenne-coupe-platinum-2022': '00000260',
  'bmw-320i-m-sport-2022': '00000272',
  'dodge-ram-2500-rebel-2021': '00000289',
  'bmw-x4-m40i-2024': '00000469',
};

const { Pool } = pg;
const pool = new Pool({ connectionString: DATABASE_URL, max: 3 });

async function insertVehicle(client, v) {
  const res = await client.query(
    `insert into vehicles (
       slug, brand, model, year, body_type, color,
       price, mileage, badge, featured,
       fuel, transmission, power,
       spec_engine, spec_acceleration, spec_top_speed, spec_doors, spec_seats,
       description, status, published_at
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
       case when $21 then now() else null end
     )
     on conflict (slug) do nothing
     returning id`,
    [
      v.slug, v.brand, v.model, v.year, v.body_type, v.color,
      v.price, v.mileage, v.badge, v.featured,
      v.fuel, v.transmission, v.power,
      v.spec_engine, v.spec_acceleration, v.spec_top_speed, v.spec_doors, v.spec_seats,
      v.description, v.status, v.publishNow,
    ]
  );
  return res.rows[0]?.id ?? null; // null = já existia
}

async function listJpegs(dir) {
  try {
    const entries = await readdir(dir);
    return entries.filter((n) => /\.jpe?g$/i.test(n)).sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

async function seedImages(client, slug) {
  const { rows } = await client.query('select id from vehicles where slug = $1', [slug]);
  const vehicleId = rows[0]?.id;
  if (!vehicleId) {
    console.warn(`   ⚠️  ${slug} não está no banco — pulando fotos.`);
    return;
  }

  const { rows: existing } = await client.query(
    'select count(*)::int as n from vehicle_images where vehicle_id = $1',
    [vehicleId]
  );
  if (existing[0].n > 0) {
    console.log(`   ✓ ${slug} já tem ${existing[0].n} imagem(ns) — pulando.`);
    return;
  }

  const dir = path.join(PUBLIC_VEICULOS, slug);
  const files = await listJpegs(dir);
  if (!files.length) {
    console.warn(`   ⚠️  Sem fotos em public/veiculos/${slug} — pulando.`);
    return;
  }

  const prefix = PRIMARY_PREFIX[slug];
  const primaryIdx = prefix ? files.findIndex((f) => f.startsWith(prefix)) : 0;
  if (primaryIdx > 0) {
    const [primary] = files.splice(primaryIdx, 1);
    files.unshift(primary);
  }

  let position = 0;
  for (const file of files) {
    await client.query(
      `insert into vehicle_images (vehicle_id, position, is_primary, url)
       values ($1, $2, $3, $4)`,
      [vehicleId, position, position === 0, `/veiculos/${slug}/${file}`]
    );
    position += 1;
  }
  console.log(`   📸 ${slug}: ${position} foto(s) registradas.`);
}

async function main() {
  const client = await pool.connect();
  try {
    console.log('[1/2] Inserindo fichas dos 8 veículos...');
    let created = 0;
    for (const v of VEHICLES) {
      const id = await insertVehicle(client, v);
      if (id) {
        created += 1;
        console.log(`   + ${v.slug} (${v.status})`);
      } else {
        console.log(`   = ${v.slug} já existia — mantido.`);
      }
    }
    console.log(`   → ${created} criado(s), ${VEHICLES.length - created} mantido(s).`);

    console.log('\n[2/2] Registrando fotos dos veículos com lote pronto...');
    for (const slug of Object.keys(PRIMARY_PREFIX)) {
      await seedImages(client, slug);
    }

    console.log('\n✅ Seed concluído. Confira /, /acervo e /veiculo/<slug>.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('\n❌ Erro no seed:', err.message);
  process.exit(1);
});
