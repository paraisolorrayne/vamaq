/**
 * Store de veículos (Postgres) — usado pelas rotas do admin (/api/admin/*).
 *
 * Expõe a mesma interface lógica do app antigo (readVehicles, addVehicle,
 * updateVehicle, deleteVehicle, getVehicleById), mas persistindo no Postgres
 * via o pool de src/lib/db.js. Retorna objetos no shape que o admin consome
 * (bodyType camelCase + jsonb opcionais/blindagem/images/specs).
 */
import { getPool } from '@/lib/db';

const SELECT_COLS = `
  id, slug, brand, model, year, price, quilometragem,
  fuel, transmission, power, color, body_type, featured, badge,
  opcionais, blindagem, images, specs, description, published,
  created_at, updated_at
`;

function rowToVehicle(row) {
  if (!row) return null;
  const { body_type, price, ...rest } = row;
  return {
    ...rest,
    price: price !== null && price !== undefined ? Number(price) : null,
    bodyType: body_type,
  };
}

function slugify(brand, model, year) {
  const base = `${brand}-${model}-${year}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return `${base}-${Date.now()}`;
}

function normalize(body) {
  return {
    brand: body.brand || '',
    model: body.model || '',
    year: Math.round(Number(body.year)) || new Date().getFullYear(),
    price: body.price !== '' && body.price != null ? Number(body.price) : null,
    // Colunas integer: arredonda para não estourar 22P02 se algum cliente
    // mandar float (ex.: km digitado com separador de milhar).
    quilometragem: Math.round(Number(body.quilometragem)) || 0,
    fuel: body.fuel || 'Gasolina',
    transmission: body.transmission || 'Automático',
    power: body.power || '',
    color: body.color || '',
    body_type: body.bodyType || 'Sedan',
    featured: Boolean(body.featured),
    badge: body.badge || null,
    opcionais: Array.isArray(body.opcionais) ? body.opcionais : [],
    blindagem: body.blindagem || { blindado: false, tipo: '' },
    images: body.images || { main: '', gallery: [] },
    specs: body.specs || {
      engine: '',
      acceleration: '',
      topSpeed: '',
      doors: 4,
      seats: 5,
    },
    description: body.description || '',
    published: body.published === undefined ? true : Boolean(body.published),
  };
}

export async function readVehicles() {
  const pool = getPool();
  if (!pool) return [];
  const { rows } = await pool.query(
    `select ${SELECT_COLS} from vehicles order by created_at desc`
  );
  return rows.map(rowToVehicle);
}

export async function getVehicleById(id) {
  const pool = getPool();
  if (!pool) return null;
  const { rows } = await pool.query(
    `select ${SELECT_COLS} from vehicles where id = $1`,
    [id]
  );
  return rows.length ? rowToVehicle(rows[0]) : null;
}

export async function addVehicle(body) {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL ausente');
  const v = normalize(body);
  const slug = slugify(v.brand, v.model, v.year);
  const { rows } = await pool.query(
    `insert into vehicles (
       slug, brand, model, year, price, quilometragem,
       fuel, transmission, power, color, body_type, featured, badge,
       opcionais, blindagem, images, specs, description, published
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
       $14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18,$19
     )
     returning ${SELECT_COLS}`,
    [
      slug, v.brand, v.model, v.year, v.price, v.quilometragem,
      v.fuel, v.transmission, v.power, v.color, v.body_type, v.featured, v.badge,
      JSON.stringify(v.opcionais), JSON.stringify(v.blindagem),
      JSON.stringify(v.images), JSON.stringify(v.specs), v.description, v.published,
    ]
  );
  return rowToVehicle(rows[0]);
}

export async function updateVehicle(id, body) {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL ausente');
  const v = normalize(body);
  const { rows } = await pool.query(
    `update vehicles set
       brand=$2, model=$3, year=$4, price=$5, quilometragem=$6,
       fuel=$7, transmission=$8, power=$9, color=$10, body_type=$11,
       featured=$12, badge=$13,
       opcionais=$14::jsonb, blindagem=$15::jsonb, images=$16::jsonb, specs=$17::jsonb,
       description=$18, published=$19
     where id=$1
     returning ${SELECT_COLS}`,
    [
      id, v.brand, v.model, v.year, v.price, v.quilometragem,
      v.fuel, v.transmission, v.power, v.color, v.body_type, v.featured, v.badge,
      JSON.stringify(v.opcionais), JSON.stringify(v.blindagem),
      JSON.stringify(v.images), JSON.stringify(v.specs), v.description, v.published,
    ]
  );
  return rows.length ? rowToVehicle(rows[0]) : null;
}

export async function deleteVehicle(id) {
  const pool = getPool();
  if (!pool) return false;
  const { rowCount } = await pool.query('delete from vehicles where id = $1', [id]);
  return rowCount > 0;
}
