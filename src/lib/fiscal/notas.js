/**
 * Emissão de NF-e do veículo: orquestra o payload, a Focus e o espelho local.
 * Server-only. Só admin e financeiro chegam aqui (ver as Server Actions).
 */
import { randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import { montarPayloadNfe } from "@/lib/fiscal/payload";
import { focusEnabled, emitirNfe, consultarNfe, cancelarNfe } from "@/lib/fiscal/focus/client";
import { getVehicleMargins } from "@/lib/fin/repositories/finance";

export { focusEnabled };

export async function getFiscalConfig() {
  const { rows } = await query(`select * from fiscal_config order by created_at limit 1`);
  return rows[0] || null;
}

/**
 * Junta o que a tela de conferência precisa mostrar. O custo de aquisição vem
 * do financeiro; quando o veículo não tem compra lançada, devolvemos
 * custoOrigem='ausente' para a tela PEDIR o valor em vez de assumir zero —
 * base zerada viraria ICMS zerado numa nota real.
 */
export async function getDadosEmissao(vehicleId) {
  const v = await query(
    `select id, brand, model, year, price, placa, chassi, status
       from vehicles where id = $1`,
    [vehicleId]
  );
  if (!v.rows.length) return null;

  let custoAquisicao = 0;
  let custoOrigem = "ausente";
  try {
    const margens = await getVehicleMargins({ onlyWithActivity: false });
    const m = margens.find((x) => x.vehicle_id === vehicleId);
    if (m && m.custo_aquisicao > 0) {
      custoAquisicao = m.custo_aquisicao;
      custoOrigem = "financeiro";
    }
  } catch {
    // Financeiro indisponível não impede a emissão: a tela pede o valor.
    custoOrigem = "ausente";
  }

  return { veiculo: v.rows[0], config: await getFiscalConfig(), custoAquisicao, custoOrigem };
}

/** Traduz o status da Focus para o nosso. */
function traduzStatus(s) {
  if (s === "autorizado") return "autorizada";
  if (s === "cancelado") return "cancelada";
  if (s === "processando_autorizacao") return "processando";
  return "erro";
}

/** Grava/atualiza o espelho local a partir da resposta da Focus. */
async function salvarRetorno(ref, retorno) {
  const status = traduzStatus(retorno?.status);
  const { rows } = await query(
    `update notas_fiscais set
       status = $2, numero = $3, serie = $4, chave = $5,
       mensagem = $6, xml_url = $7, danfe_url = $8, raw = $9::jsonb
     where ref = $1 returning *`,
    [
      ref, status,
      retorno?.numero || null, retorno?.serie || null, retorno?.chave_nfe || null,
      retorno?.mensagem_sefaz || retorno?.mensagem || null,
      retorno?.caminho_xml_nota_fiscal || null,
      retorno?.caminho_danfe || null,
      JSON.stringify(retorno || {}),
    ]
  );
  return rows[0] || null;
}

export async function emitirNotaVeiculo(vehicleId, { destinatario, valorVenda, custoAquisicao }) {
  if (!focusEnabled()) return { error: "Emissor fiscal não configurado." };

  const dados = await getDadosEmissao(vehicleId);
  if (!dados) return { error: "Veículo não encontrado." };
  if (!dados.config) return { error: "Parâmetros fiscais não cadastrados. Peça ao contador." };

  const montado = montarPayloadNfe({
    config: dados.config,
    veiculo: dados.veiculo,
    destinatario,
    valorVenda,
    custoAquisicao,
  });
  if (montado.error) return { error: montado.error };

  // ref única e imutável: nota rejeitada é reemitida com ref NOVA.
  const ref = `vamaq-${randomUUID()}`;
  await query(
    `insert into notas_fiscais (ref, vehicle_id, status, valor, destinatario, serie)
     values ($1,$2,'processando',$3,$4::jsonb,$5)`,
    [ref, vehicleId, Number(valorVenda), JSON.stringify(destinatario), String(dados.config.serie)]
  );

  try {
    const retorno = await emitirNfe(ref, montado.payload);
    const nota = await salvarRetorno(ref, retorno);
    return { nota };
  } catch (err) {
    const nota = await query(
      `update notas_fiscais set status='erro', mensagem=$2 where ref=$1 returning *`,
      [ref, String(err.message)]
    );
    return { error: String(err.message), nota: nota.rows[0] };
  }
}

export async function atualizarStatus(ref) {
  if (!focusEnabled()) return { error: "Emissor fiscal não configurado." };
  try {
    const nota = await salvarRetorno(ref, await consultarNfe(ref));
    return nota ? { nota } : { error: "Nota não encontrada." };
  } catch (err) {
    return { error: String(err.message) };
  }
}

export async function cancelarNota(ref, justificativa) {
  const j = String(justificativa || "").trim();
  if (j.length < 15) return { error: "A justificativa precisa ter pelo menos 15 caracteres." };
  if (!focusEnabled()) return { error: "Emissor fiscal não configurado." };
  try {
    await cancelarNfe(ref, j);
    const { rows } = await query(
      `update notas_fiscais set status='cancelada', justificativa_cancelamento=$2,
              cancelada_em=now() where ref=$1 returning *`,
      [ref, j]
    );
    return { nota: rows[0] };
  } catch (err) {
    return { error: String(err.message) };
  }
}

export async function listNotas() {
  const { rows } = await query(
    `select n.*, v.brand, v.model, v.year, v.placa
       from notas_fiscais n
       join vehicles v on v.id = n.vehicle_id
      order by n.created_at desc`
  );
  return rows.map((r) => ({ ...r, valor: r.valor != null ? Number(r.valor) : 0 }));
}
