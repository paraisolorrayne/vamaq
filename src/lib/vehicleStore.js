/**
 * Store de veículos (Postgres) — usado pelas rotas do admin (/api/admin/*).
 *
 * Expõe a mesma interface lógica do app antigo (readVehicles, addVehicle,
 * updateVehicle, deleteVehicle, getVehicleById), mas persistindo no Postgres
 * via o pool de src/lib/db.js. Retorna objetos no shape que o admin consome
 * (bodyType camelCase + jsonb opcionais/blindagem/images/specs).
 */
import { getPool } from '@/lib/db';
import { normalizaMarca } from '@/lib/marcaVeiculo';

const SELECT_COLS = `
  id, slug, brand, model, year, ano_modelo, price, quilometragem,
  fuel, transmission, power, color, body_type, featured, badge,
  opcionais, blindagem, images, specs, description, published, status,
  placa, chassi, documentos, renave,
  data_entrada, data_saida,
  created_at, updated_at
`;

const VEHICLE_STATUSES = ['disponivel', 'reservado', 'vendido', 'inativo'];

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
    // Grafia única: sem isto, `AUDI`, `Audi` e `Audi ` viram três marcas
    // diferentes na lista de filtros do acervo. Ver src/lib/marcaVeiculo.js.
    brand: normalizaMarca(body.brand),
    model: body.model || '',
    year: Math.round(Number(body.year)) || new Date().getFullYear(),
    // Opcional: vazio, zero ou lixo viram null — a coluna é nullable e o
    // veículo sem ano de modelo tem que continuar se comportando como antes.
    ano_modelo: Math.round(Number(body.ano_modelo)) || null,
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
    // placa/chassi em maiúsculas; vazia = null (vira pendência no inventário).
    // documentos NÃO entram aqui — são geridos pelas rotas de documento, para o
    // formulário de edição não sobrescrever a lista.
    placa: body.placa ? String(body.placa).toUpperCase().trim() : null,
    chassi: body.chassi ? String(body.chassi).toUpperCase().trim() : null,
    renave: body.renave && typeof body.renave === 'object' ? body.renave : {},
    // Datas do registro de entrada e saída. Vazio = null e NÃO a data de hoje:
    // um carro sem data de entrada é um cadastro incompleto, e preencher
    // sozinho com hoje transformaria isso num registro falso.
    data_entrada: dataOuNull(body.data_entrada),
    data_saida: dataOuNull(body.data_saida),
  };
}

/** "AAAA-MM-DD" do <input type="date">; qualquer outra coisa vira null. */
function dataOuNull(valor) {
  const t = String(valor ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
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
       slug, brand, model, year, ano_modelo, price, quilometragem,
       fuel, transmission, power, color, body_type, featured, badge,
       opcionais, blindagem, images, specs, description, published, placa, chassi, renave,
       data_entrada, data_saida
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
       $15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb,$19,$20,$21,$22,$23::jsonb,$24,$25
     )
     returning ${SELECT_COLS}`,
    [
      slug, v.brand, v.model, v.year, v.ano_modelo, v.price, v.quilometragem,
      v.fuel, v.transmission, v.power, v.color, v.body_type, v.featured, v.badge,
      JSON.stringify(v.opcionais), JSON.stringify(v.blindagem),
      JSON.stringify(v.images), JSON.stringify(v.specs), v.description, v.published,
      v.placa, v.chassi, JSON.stringify(v.renave), v.data_entrada, v.data_saida,
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
       brand=$2, model=$3, year=$4, ano_modelo=$5, price=$6, quilometragem=$7,
       fuel=$8, transmission=$9, power=$10, color=$11, body_type=$12,
       featured=$13, badge=$14,
       opcionais=$15::jsonb, blindagem=$16::jsonb, images=$17::jsonb, specs=$18::jsonb,
       description=$19, published=$20, placa=$21, chassi=$22, renave=$23::jsonb,
       data_entrada=$24, data_saida=$25
     where id=$1
     returning ${SELECT_COLS}`,
    [
      id, v.brand, v.model, v.year, v.ano_modelo, v.price, v.quilometragem,
      v.fuel, v.transmission, v.power, v.color, v.body_type, v.featured, v.badge,
      JSON.stringify(v.opcionais), JSON.stringify(v.blindagem),
      JSON.stringify(v.images), JSON.stringify(v.specs), v.description, v.published,
      v.placa, v.chassi, JSON.stringify(v.renave), v.data_entrada, v.data_saida,
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

// Ciclo de vida por status (PR-C do ADR-002). Substitui a exclusão na UI:
// 'vendido'/'inativo' também saem do site (published=false) na mesma operação,
// preservando o histórico do veículo. Retorna o veículo atualizado ou null.
export async function setVehicleStatus(id, status) {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL ausente');
  if (!VEHICLE_STATUSES.includes(status)) {
    throw new Error(`Status inválido: ${status}`);
  }
  // vendido/inativo somem do site; disponível/reservado não mexem em published.
  const unpublish = status === 'vendido' || status === 'inativo';
  // Marcar vendido carimba a data de saída — é o momento em que ela é
  // conhecida, e pedir para a operadora digitar de novo o que o sistema acabou
  // de saber é como o campo ficaria sempre vazio. `coalesce` protege quem já
  // tinha data: reprocessar uma venda não reescreve a saída original, e a
  // pessoa continua podendo corrigir a data na tela de edição.
  const { rows } = await pool.query(
    `update vehicles
        set status = $2,
            published = case when $3 then false else published end,
            data_saida = case
              when $2 = 'vendido' then coalesce(data_saida, current_date)
              else data_saida
            end
      where id = $1
      returning ${SELECT_COLS}`,
    [id, status, unpublish]
  );
  return rows.length ? rowToVehicle(rows[0]) : null;
}

// --- Documentos do veículo (PR-Inventário) -------------------------------
// Metadados ficam no jsonb `documentos`; os arquivos, em disco privado
// (data/vehicle-docs/), geridos pelas rotas /api/admin/vehicles/[id]/documents.

export async function addVehicleDocument(id, doc) {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL ausente');
  const { rows } = await pool.query(
    `update vehicles set documentos = documentos || $2::jsonb
      where id = $1 returning ${SELECT_COLS}`,
    [id, JSON.stringify([doc])]
  );
  return rows.length ? rowToVehicle(rows[0]) : null;
}

// Remove o doc do jsonb e devolve seus metadados (para a rota apagar o arquivo).
export async function removeVehicleDocument(id, docId) {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL ausente');
  const cur = await pool.query('select documentos from vehicles where id = $1', [id]);
  if (!cur.rows.length) return { vehicle: null, removed: null };
  const docs = Array.isArray(cur.rows[0].documentos) ? cur.rows[0].documentos : [];
  const removed = docs.find((d) => d.id === docId) || null;
  const kept = docs.filter((d) => d.id !== docId);
  const { rows } = await pool.query(
    `update vehicles set documentos = $2::jsonb where id = $1 returning ${SELECT_COLS}`,
    [id, JSON.stringify(kept)]
  );
  return { vehicle: rows.length ? rowToVehicle(rows[0]) : null, removed };
}

// Um veículo tem pendência de inventário se falta placa ou não tem documentos.
export function vehiclePendencias(v) {
  const faltas = [];
  if (!v.placa) faltas.push('placa');
  if (!Array.isArray(v.documentos) || v.documentos.length === 0) faltas.push('documentos');
  return faltas;
}

export { VEHICLE_STATUSES };
