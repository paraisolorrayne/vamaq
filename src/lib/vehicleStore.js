/**
 * Store de veículos (Postgres) — usado pelas rotas do admin (/api/admin/*).
 *
 * Expõe a mesma interface lógica do app antigo (readVehicles, addVehicle,
 * updateVehicle, deleteVehicle, getVehicleById), mas persistindo no Postgres
 * via o pool de src/lib/db.js. Retorna objetos no shape que o admin consome
 * (bodyType camelCase + jsonb opcionais/blindagem/images/specs).
 */
import { getPool } from '@/lib/db';
import { normalizaMarca, normalizaModelo } from '@/lib/marcaVeiculo';
import { podeRetornarAoEstoque } from '@/lib/estoque/retornoVeiculo';

const SELECT_COLS = `
  id, slug, brand, model, year, ano_modelo, price, quilometragem,
  fuel, transmission, power, color, body_type, featured, badge,
  opcionais, blindagem, images, specs, description, published, status, ciclo,
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
    // Mesma razão da marca, um campo ao lado: espaço dobrado no modelo virava
    // hífen dobrado no slug (`volkswagen--t-cross--`) e, com o filtro de
    // modelo no acervo, viraria a mesma opção listada duas vezes.
    model: normalizaModelo(body.model),
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
// `republicar` existe porque devolver um carro ao estoque não republicava: esta
// função só mexia em `published` para TIRAR do ar, e "Reativar" devolvia o carro
// ao estoque mas não ao site, sem avisar ninguém. Não vira automático em toda
// volta para `disponivel` porque o cadastro tem uma caixa `published` própria
// (estoque/novo/page.js) — "disponível e fora do site" é um estado que alguém
// escolhe. Só as ações em que a pessoa declarou a intenção passam `true`.
export async function setVehicleStatus(id, status, { republicar = false } = {}) {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL ausente');
  if (!VEHICLE_STATUSES.includes(status)) {
    throw new Error(`Status inválido: ${status}`);
  }
  // vendido/inativo somem do site; disponível/reservado não mexem em published.
  const unpublish = status === 'vendido' || status === 'inativo';
  // Sair do site vence o republicar: "marcar vendido" não pode pôr no ar.
  const publicar = republicar && !unpublish;
  // Marcar vendido carimba a data de saída — é o momento em que ela é
  // conhecida, e pedir para a operadora digitar de novo o que o sistema acabou
  // de saber é como o campo ficaria sempre vazio. `coalesce` protege quem já
  // tinha data: reprocessar uma venda não reescreve a saída original, e a
  // pessoa continua podendo corrigir a data na tela de edição.
  const { rows } = await pool.query(
    `update vehicles
        set status = $2,
            published = case
              when $3 then false
              when $4 then true
              else published
            end,
            data_saida = case
              when $2 = 'vendido' then coalesce(data_saida, current_date)
              else data_saida
            end
      where id = $1
      returning ${SELECT_COLS}`,
    [id, status, unpublish, publicar]
  );
  return rows.length ? rowToVehicle(rows[0]) : null;
}

/**
 * O carro vendido volta ao estoque, abrindo um ciclo novo.
 *
 * É o caso do carro que a Vamaq vendeu e recebeu de VOLTA como parte do
 * pagamento de outro (Mayra, 17/09/2026). Fiscalmente é uma nova aquisição:
 * nota de entrada própria, custo próprio, e a próxima nota de venda cita ESSA
 * entrada — por isso um ciclo novo, e não só um status trocado.
 *
 * Tudo numa transação com `for update`: o histórico e os quatro campos do
 * veículo têm que cair juntos, e dois cliques simultâneos abririam dois ciclos.
 * Por isso também não reusa setVehicleStatus, que abriria a própria transação.
 */
export async function retornarAoEstoque(id, userId) {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL ausente');

  const client = await pool.connect();
  try {
    await client.query('begin');

    const atual = await client.query(
      `select id, status, ciclo, data_entrada, data_saida, price
         from vehicles where id = $1 for update`,
      [id]
    );
    if (!atual.rows.length) {
      // .catch() aqui pela mesma razão do catch mais abaixo: numa conexão
      // morta o rollback rejeitaria, e isso não pode impedir o retorno de
      // { error } — a função continuaria "explodindo" pelo motivo errado.
      await client.query('rollback').catch(() => {});
      return { error: 'Veículo não encontrado.' };
    }
    // Mesma regra do botão na lista — reconferida aqui porque a rota é
    // alcançável fora dela (link salvo, histórico do navegador).
    if (!podeRetornarAoEstoque(atual.rows[0])) {
      await client.query('rollback').catch(() => {});
      return {
        error: 'Só um veículo vendido volta ao estoque. Este está como ' +
          `"${atual.rows[0].status}".`,
      };
    }

    const v = atual.rows[0];
    // O ciclo que fecha vai para o histórico ANTES de as colunas serem
    // reescritas: data_entrada e data_saida são uma só de cada, e sem isto a
    // compra original sumiria do relatório de entradas e saídas.
    await client.query(
      `insert into vehicle_ciclos
         (vehicle_id, ciclo, data_entrada, data_saida, price, encerrado_por)
       values ($1,$2,$3,$4,$5,$6)`,
      [id, v.ciclo, v.data_entrada, v.data_saida, v.price, userId || null]
    );

    // A entrada é HOJE: é a data da nova aquisição, e é dela que a coluna
    // "Qtd dias" da lista de estoque passa a contar. O preço fica como estava —
    // é ponto de partida para reprecificar, não um número a adivinhar.
    const { rows } = await client.query(
      `update vehicles
          set ciclo = ciclo + 1,
              status = 'disponivel',
              published = true,
              data_entrada = current_date,
              data_saida = null
        where id = $1
        returning ${SELECT_COLS}`,
      [id]
    );

    await client.query('commit');
    return { ok: true, vehicle: rowToVehicle(rows[0]) };
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Os ciclos já encerrados de todos os carros — o passado do pátio. */
export async function readCiclosEncerrados() {
  const pool = getPool();
  if (!pool) return [];
  const { rows } = await pool.query(
    `select vehicle_id, ciclo, data_entrada, data_saida, price
       from vehicle_ciclos order by vehicle_id, ciclo`
  );
  return rows;
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
