/**
 * Repositório do CRM (funil de vendas). Usa a conexão do app (vamaq) — o
 * vendedor trabalha os leads e pode marcar o veículo como vendido ao ganhar.
 */
import { query } from "@/lib/db";
import { valorDaOportunidade } from "./valor.js";
import { ETAPAS } from "./etapas.js";

const SELECT = `
  select o.id, o.cliente_nome, o.telefone, o.email, o.etapa, o.valor, o.origem,
         o.obs, o.motivo_perda, o.vehicle_id, o.responsavel_id,
         v.brand as vehicle_brand, v.model as vehicle_model, v.year as vehicle_year,
         v.ano_modelo as vehicle_ano_modelo, v.placa as vehicle_placa,
         u.name as responsavel_nome,
         o.created_at, o.updated_at
    from oportunidades o
    left join vehicles v on v.id = o.vehicle_id
    left join users u on u.id = o.responsavel_id
`;

function row(r) {
  // A coluna `valor` é `numeric` no Postgres, que aceita NaN (foi assim que
  // o defeito antigo gravou dado corrompido, antes da escrita ser corrigida
  // nesta branch). Uma linha com NaN gravado viraria "R$ NaN" na tela sem
  // explicação — por isso NaN também vira null na leitura, igual a um valor
  // ausente.
  const valor = r.valor != null ? Number(r.valor) : null;
  return { ...r, valor: Number.isNaN(valor) ? null : valor };
}

function normalize(b) {
  return {
    cliente_nome: (b.cliente_nome || "").trim(),
    telefone: b.telefone || null,
    email: b.email || null,
    vehicle_id: b.vehicle_id || null,
    etapa: ETAPAS.includes(b.etapa) ? b.etapa : "novo",
    valor: valorDaOportunidade(b.valor),
    origem: b.origem || null,
    obs: b.obs || null,
    motivo_perda: b.motivo_perda || null,
  };
}

export async function listOportunidades() {
  try {
    const { rows } = await query(`${SELECT} order by o.updated_at desc`);
    return rows.map(row);
  } catch (err) {
    console.error("[crm] list error:", err);
    return [];
  }
}

export async function getOportunidade(id) {
  const { rows } = await query(`${SELECT} where o.id = $1`, [id]);
  return rows.length ? row(rows[0]) : null;
}

export async function createOportunidade(body, responsavelId) {
  const v = normalize(body);
  if (!v.cliente_nome) throw new Error("Nome do cliente é obrigatório");
  const { rows } = await query(
    `insert into oportunidades
       (cliente_nome, telefone, email, vehicle_id, etapa, valor, origem, obs, responsavel_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [v.cliente_nome, v.telefone, v.email, v.vehicle_id, v.etapa, v.valor, v.origem, v.obs, responsavelId || null]
  );
  return getOportunidade(rows[0].id);
}

// `etapa` e `motivo_perda` NÃO entram aqui de propósito — não é esquecimento.
// O formulário de edição não tem campo para nenhuma das duas, então
// `normalize()` cairia no fallback ("novo" etapa, motivo_perda null) e um
// UPDATE que as incluísse apagaria a etapa e o motivo da perda de qualquer
// oportunidade editada, mesmo sem a pessoa mexer nisso (é o que aconteceu:
// editar só o telefone de uma oportunidade Ganha ou Perdida a jogava de
// volta para "novo" e zerava o motivo). Quem manda em etapa é o
// PATCH/setEtapa — e só ele. Se um dia `etapa`/`motivo_perda` precisarem
// ser editáveis por aqui, o formulário tem que mandar os dois de verdade
// (não herdar de um default), e mesmo assim a troca de etapa deveria passar
// por setEtapa, não por um UPDATE solto.
const UPDATE = `
  update oportunidades set
    cliente_nome=$2, telefone=$3, email=$4, vehicle_id=$5,
    valor=$6, origem=$7, obs=$8
  where id=$1 returning id
`;

export async function updateOportunidade(id, body) {
  const v = normalize(body);
  if (!v.cliente_nome) throw new Error("Nome do cliente é obrigatório");
  const { rows } = await query(UPDATE, [
    id,
    v.cliente_nome,
    v.telefone,
    v.email,
    v.vehicle_id,
    v.valor,
    v.origem,
    v.obs,
  ]);
  return rows.length ? getOportunidade(id) : null;
}

export async function setEtapa(id, etapa, motivoPerda) {
  if (!ETAPAS.includes(etapa)) throw new Error("Etapa inválida");
  const { rows } = await query(
    `update oportunidades set etapa=$2, motivo_perda = case when $2='perdido' then $3 else motivo_perda end
      where id=$1 returning id`,
    [id, etapa, motivoPerda || null]
  );
  return rows.length ? getOportunidade(id) : null;
}

export async function deleteOportunidade(id) {
  const { rowCount } = await query(`delete from oportunidades where id=$1`, [id]);
  return rowCount > 0;
}
