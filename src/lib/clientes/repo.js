/**
 * Cadastro de clientes e o vínculo com os veículos que passaram pela mão deles.
 * Server-only (usa pg). Padrão de src/lib/rh/funcionarios.js: valida, normaliza
 * e devolve {error} em vez de lançar quando o erro é do operador.
 */
import { query } from "@/lib/db";
import { normalizaDoc, tipoPorDoc, docValido } from "@/lib/clientes/doc";

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

// Mesma classe de defeito já corrigida no `obs` do vínculo (ligarVeiculo):
// campo opcional que chega não-string (ex.: {"rg":123}) quebra em
// `.trim is not a function` antes de virar {error}. `String(v ?? "")`
// aceita qualquer tipo sem lançar.
const txt = (v) => String(v ?? "").trim() || null;

/** Valida e normaliza o que veio do formulário. Retorna {values} ou {error}. */
async function prepararCliente(data, { ignorarId = null } = {}) {
  const nome = String(data.nome || "").trim();
  if (!nome) return { error: "Nome é obrigatório." };

  const doc = normalizaDoc(data.doc);
  if (doc && !docValido(doc)) return { error: "CPF/CNPJ deve ter 11 ou 14 dígitos." };

  // Se o documento tem tamanho conhecido (11 ou 14 dígitos), ele decide o
  // tipo — só cai no que veio do formulário quando o documento está vazio
  // ou é curto demais para saber.
  let tipo = tipoPorDoc(doc) || data.tipo || "pf";
  if (tipo !== "pf" && tipo !== "pj") tipo = "pf";

  if (doc) {
    const dup = await query(
      `select id from clientes where doc = $1 and ($2::uuid is null or id <> $2)`,
      [doc, ignorarId]
    );
    if (dup.rows.length) return { error: "Já existe um cliente com esse CPF/CNPJ." };
  }

  const cep = normalizaDoc(data.cep);
  const representanteCpf = normalizaDoc(data.representante_cpf);
  const uf = String(data.uf || "").trim().toUpperCase().slice(0, 2);
  const email = txt(data.email);

  return {
    values: {
      nome,
      tipo,
      doc: doc || null,
      rg: txt(data.rg),
      cnh: txt(data.cnh),
      cnh_categoria: txt(data.cnh_categoria),
      email: email ? email.toLowerCase() : null,
      telefone: txt(data.telefone),
      cep: cep || null,
      logradouro: txt(data.logradouro),
      numero: txt(data.numero),
      complemento: txt(data.complemento),
      bairro: txt(data.bairro),
      municipio: txt(data.municipio),
      uf: uf || null,
      representante_nome: txt(data.representante_nome),
      representante_cpf: representanteCpf || null,
      obs: txt(data.obs),
    },
  };
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

/** Ficha completa: dados, veículos, documentos e notas fiscais ligados. */
export async function getCliente(id) {
  const c = await query(`select * from clientes where id = $1`, [id]);
  if (!c.rows.length) return null;

  const veiculos = await query(
    `select cv.id as vinculo_id, cv.papel, cv.data, cv.origem,
            v.id as vehicle_id, v.brand, v.model, v.year, v.placa, v.status
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

  return {
    ...c.rows[0],
    veiculos: veiculos.rows,
    documentos: documentos.rows,
    notas: notas.rows,
  };
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
