/**
 * Cadastro de clientes e o vínculo com os veículos que passaram pela mão deles.
 * Server-only (usa pg). Padrão de src/lib/rh/funcionarios.js: valida, normaliza
 * e devolve {error} em vez de lançar quando o erro é do operador.
 */
import { query } from "@/lib/db";
import { normalizaDoc } from "@/lib/clientes/doc";
import { prepararCampos } from "@/lib/clientes/campos";

const CAMPOS = [
  "nome",
  "tipo",
  "doc",
  "rg",
  "cnh",
  "cnh_categoria",
  "email",
  "telefone",
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "municipio",
  "uf",
  "representante_nome",
  "representante_cpf",
  "obs",
];

const PAPEIS = ["comprou", "vendeu", "consignou"];

// Escapa os curingas do LIKE (% e _) e o próprio escape (\) antes de montar o
// padrão — sem isso, buscar por "%" ou "_" lista tudo em vez de nada.
// Copiado de src/lib/documentos.js:45.
function escapeCuringasLike(str) {
  return str.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Valida e normaliza o que veio do formulário (via campos.js, puro) e, se
 * passar, checa duplicidade de documento no banco. Retorna {values} ou
 * {error}.
 */
async function prepararCliente(data, { ignorarId = null } = {}) {
  const p = prepararCampos(data);
  if (p.error) return p;
  const { values } = p;

  if (values.doc) {
    const dup = await query(
      `select id from clientes where doc = $1 and ($2::uuid is null or id <> $2)`,
      [values.doc, ignorarId]
    );
    if (dup.rows.length) return { error: "Já existe um cliente com esse CPF/CNPJ." };
  }

  return { values };
}

/** Lista de clientes, com o total de veículos vinculados a cada um. */
export async function listClientes({ busca, incluirInativos = false } = {}) {
  const params = [];
  const condicoes = [];

  if (!incluirInativos) condicoes.push(`c.ativo`);

  const termo = String(busca || "").trim();
  if (termo) {
    params.push(`%${escapeCuringasLike(termo)}%`);
    const nomeIdx = params.length;
    let clause = `lower(c.nome) like lower($${nomeIdx})`;

    const digitos = normalizaDoc(termo);
    if (digitos) {
      params.push(`%${digitos}%`);
      const digIdx = params.length;
      clause += ` or regexp_replace(coalesce(c.doc,''), '\\D', '', 'g') like $${digIdx}`;
      clause += ` or regexp_replace(coalesce(c.telefone,''), '\\D', '', 'g') like $${digIdx}`;
    }
    condicoes.push(`(${clause})`);
  }

  const where = condicoes.length ? `where ${condicoes.join(" and ")}` : "";
  // Sem `select c.*`: a lista é consumida pelo vendedor (seletor de contrato
  // e de NF-e), e `obs` (nota interna sobre o cliente) e `rg` não têm por que
  // sair daqui — quem precisa deles é a ficha (getCliente), que já é
  // restrita a secretaria/financeiro. As demais colunas ficam porque o
  // seletor de contrato/NF-e preenche os campos do documento a partir do
  // cliente já carregado na lista (ver camposDoTemplate/destinatarioDoCliente
  // em src/lib/clientes/prefill.js).
  const { rows } = await query(
    `select c.id, c.nome, c.tipo, c.doc, c.email, c.telefone, c.ativo,
            c.cnh, c.cnh_categoria, c.cep, c.logradouro, c.numero, c.complemento,
            c.bairro, c.municipio, c.uf, c.representante_nome, c.representante_cpf,
            (select count(*)::int from cliente_veiculos cv where cv.cliente_id = c.id) as veiculos_count
       from clientes c
       ${where}
      order by c.nome`,
    params
  );
  return rows;
}

/** Ficha completa: dados, veículos, documentos, notas fiscais e oportunidades ligados. */
export async function getCliente(id) {
  const c = await query(`select * from clientes where id = $1`, [id]);
  if (!c.rows.length) return null;

  const veiculos = await query(
    `select cv.id as vinculo_id, cv.papel, cv.data, cv.origem,
            v.id as vehicle_id, v.brand, v.model, v.year, v.ano_modelo, v.placa, v.status
       from cliente_veiculos cv
       join vehicles v on v.id = cv.vehicle_id
      where cv.cliente_id = $1
      order by cv.data desc nulls last, cv.created_at desc`,
    [id]
  );

  const documentos = await query(
    `select id, tipo, titulo, created_at
       from documentos_gerados
      where cliente_id = $1
      order by created_at desc`,
    [id]
  );

  const notas = await query(
    `select ref, status, valor, created_at
       from notas_fiscais
      where cliente_id = $1
      order by created_at desc`,
    [id]
  );

  const oportunidades = await query(
    `select o.id, o.etapa, o.valor, o.created_at,
            v.brand as vehicle_brand, v.model as vehicle_model,
            v.year as vehicle_year, v.ano_modelo as vehicle_ano_modelo
       from oportunidades o
       left join vehicles v on v.id = o.vehicle_id
      where o.cliente_id = $1
      order by o.created_at desc`,
    [id]
  );

  return {
    ...c.rows[0],
    veiculos: veiculos.rows,
    documentos: documentos.rows,
    notas: notas.rows,
    oportunidades: oportunidades.rows,
  };
}

/**
 * Resumo mínimo do cliente — id, nome e quantos veículos estão ligados a
 * ele. Existe separado de getCliente() de propósito: a tela da oportunidade
 * do CRM (aberta pelo vendedor) só precisa desse número para o texto "N
 * carros no histórico", mas getCliente() monta a ficha inteira, e o objeto
 * que ela devolve inclui `notas` — ref, status e valor de notas fiscais, dado
 * que o vendedor não tem acesso (o GET da ficha é fechado para ele de
 * propósito). Um `prop={cliente}` descuidado naquela tela vazaria dado
 * fiscal; esta função nunca traz esse dado para começo de conversa.
 */
export async function resumoCliente(id) {
  const { rows } = await query(
    `select c.id, c.nome,
            (select count(*)::int from cliente_veiculos cv where cv.cliente_id = c.id) as veiculos_count
       from clientes c
      where c.id = $1`,
    [id]
  );
  return rows.length ? rows[0] : null;
}

export async function createCliente(data) {
  const p = await prepararCliente(data);
  if (p.error) return { error: p.error };
  const v = p.values;
  const { rows } = await query(
    `insert into clientes (${CAMPOS.join(", ")})
     values (${CAMPOS.map((_, i) => `$${i + 1}`).join(",")}) returning *`,
    CAMPOS.map((c) => v[c])
  );
  return { cliente: rows[0] };
}

export async function updateCliente(id, data) {
  const p = await prepararCliente(data, { ignorarId: id });
  if (p.error) return { error: p.error };
  const v = p.values;
  const { rows } = await query(
    `update clientes set ${CAMPOS.map((c, i) => `${c} = $${i + 2}`).join(", ")}, updated_at = now()
      where id = $1 returning *`,
    [id, ...CAMPOS.map((c) => v[c])]
  );
  if (!rows.length) return { error: "Cliente não encontrado." };
  return { cliente: rows[0] };
}

export async function setClienteAtivo(id, ativo) {
  await query(`update clientes set ativo = $2, updated_at = now() where id = $1`, [id, ativo]);
}

/** Liga o cliente a um veículo. Se o vínculo já existe, devolve o existente. */
export async function ligarVeiculo({ clienteId, vehicleId, papel, data, origem, documentoId, obs }) {
  if (!PAPEIS.includes(papel)) return { error: "Papel inválido." };

  // No conflito (vínculo já existe), o "do nothing" descarta o `obs` que
  // veio nesta chamada — de propósito: religar um cliente a um veículo que
  // ele já teve não deve sobrescrever uma observação que já estava lá.
  const { rows } = await query(
    `insert into cliente_veiculos (cliente_id, vehicle_id, papel, data, origem, documento_id, obs)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (cliente_id, vehicle_id, papel) do nothing
     returning *`,
    [clienteId, vehicleId, papel, data || null, origem || "manual", documentoId || null, String(obs || "").trim() || null]
  );
  if (rows.length) return { vinculo: rows[0] };

  // Conflito: o vínculo já existia. O chamador não precisa saber a diferença
  // entre "criei agora" e "já existia" — devolve o mesmo formato.
  const existente = await query(
    `select * from cliente_veiculos where cliente_id = $1 and vehicle_id = $2 and papel = $3`,
    [clienteId, vehicleId, papel]
  );
  return { vinculo: existente.rows[0] };
}

export async function desligarVeiculo(vinculoId) {
  await query(`delete from cliente_veiculos where id = $1`, [vinculoId]);
}
