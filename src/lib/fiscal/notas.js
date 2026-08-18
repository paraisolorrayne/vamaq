/**
 * Emissão de NF-e do veículo: orquestra o payload, a Focus e o espelho local.
 * Server-only. Só admin e financeiro chegam aqui (ver as Server Actions).
 */
import { randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import { montarPayloadNfe } from "@/lib/fiscal/payload";
import { focusEnabled, emitirNfe, consultarNfe, cancelarNfe, focusFileUrl } from "@/lib/fiscal/focus/client";
import { getVehicleMargins } from "@/lib/fin/repositories/finance";
import { ligarVeiculo } from "@/lib/clientes/repo";

export { focusEnabled };

// Mesma checagem de src/app/api/admin/clientes/[id]/route.js. `cliente_id` é
// FK para `clientes`; sem essa validação, um id malformado ou de um cliente
// apagado estoura no insert (código 23503) fora de qualquer try/catch, e a
// exceção sobe crua até a tela de emissão.
const UUID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERRO_CLIENTE_REMOVIDO =
  "Cliente não encontrado — o cadastro pode ter sido removido. Desmarque o cliente e emita novamente.";

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

  const { rows: notasAtivas } = await query(
    `select ref, status from notas_fiscais
      where vehicle_id = $1 and status in ('processando','autorizada')
      order by created_at desc limit 1`,
    [vehicleId]
  );

  return {
    veiculo: v.rows[0],
    config: await getFiscalConfig(),
    custoAquisicao,
    custoOrigem,
    notaExistente: notasAtivas[0] || null,
  };
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
       status = $2, numero = $3, serie = coalesce($4, serie), chave = $5,
       mensagem = $6, xml_url = $7, danfe_url = $8, raw = $9::jsonb
     where ref = $1 returning *`,
    [
      ref, status,
      retorno?.numero || null, retorno?.serie || null, retorno?.chave_nfe || null,
      retorno?.mensagem_sefaz || retorno?.mensagem || null,
      focusFileUrl(retorno?.caminho_xml_nota_fiscal),
      focusFileUrl(retorno?.caminho_danfe),
      JSON.stringify(retorno || {}),
    ]
  );
  return rows[0] || null;
}

export async function emitirNotaVeiculo(
  vehicleId,
  { destinatario, valorVenda, custoAquisicao, clienteId, numeroNotaEntrada, vendaPresencial }
) {
  if (!focusEnabled()) return { error: "Emissor fiscal não configurado." };

  const dados = await getDadosEmissao(vehicleId);
  if (!dados) return { error: "Veículo não encontrado." };
  if (!dados.config) return { error: "Parâmetros fiscais não cadastrados. Peça ao contador." };

  if (dados.veiculo.status !== "vendido") {
    return { error: "Só é possível emitir nota de veículo vendido." };
  }
  const { rows: existentes } = await query(
    `select ref, status from notas_fiscais
      where vehicle_id=$1 and status in ('processando','autorizada')`,
    [vehicleId]
  );
  if (existentes.length) {
    // Mesma distinção da tela: nota em processamento não se cancela (não tem
    // protocolo ainda) — ela termina sozinha. Mandar cancelar é conselho que
    // não funciona e assusta quem acabou de emitir certo.
    return {
      error:
        existentes[0].status === "processando"
          ? "A nota deste veículo já foi enviada e está sendo autorizada pela SEFAZ. Aguarde alguns segundos e veja em Notas Fiscais — não emita de novo."
          : "Este veículo já tem nota autorizada. Cancele a atual antes de emitir outra.",
    };
  }

  // O custo de aquisição NÃO entra mais no cálculo do imposto (a base do ICMS
  // é percentual sobre a venda — ver lib/fiscal/impostos.js). Ele continua
  // obrigatório porque vai no texto das informações complementares, que é o
  // que liga a nota de saída à origem do veículo.
  //
  // Quando o financeiro já tem o valor lançado, ele é AUTORITATIVO: o que a
  // tela manda (readOnly não é validação de servidor) é ignorado.
  const custo =
    dados.custoOrigem === "financeiro" ? dados.custoAquisicao : Number(custoAquisicao) || 0;
  if (custo <= 0) {
    return {
      error:
        "Informe o valor de aquisição — ele vai nas informações complementares da nota, identificando de onde o veículo veio.",
    };
  }
  if (clienteId && !UUID_VALIDO.test(clienteId)) {
    return { error: ERRO_CLIENTE_REMOVIDO };
  }

  const montado = montarPayloadNfe({
    config: dados.config,
    veiculo: dados.veiculo,
    destinatario,
    valorVenda,
    custoAquisicao: custo,
    numeroNotaEntrada,
    vendaPresencial,
  });
  if (montado.error) return { error: montado.error };

  // ref única e imutável: nota rejeitada é reemitida com ref NOVA.
  const ref = `vamaq-${randomUUID()}`;
  try {
    await query(
      `insert into notas_fiscais (ref, vehicle_id, status, valor, destinatario, serie, cliente_id)
       values ($1,$2,'processando',$3,$4::jsonb,$5,$6)`,
      [ref, vehicleId, Number(valorVenda), JSON.stringify(destinatario), String(dados.config.serie), clienteId || null]
    );
  } catch (err) {
    // Formato válido mas cliente apagado entre a tela abrir e o operador
    // emitir: a FK só estoura aqui. Fiscalmente é seguro — isso acontece
    // antes de qualquer chamada à Focus, nenhuma nota foi enviada — mas o
    // operador não tem como saber disso sem essa mensagem.
    if (err.code === "23503") {
      return { error: ERRO_CLIENTE_REMOVIDO };
    }
    throw err;
  }

  try {
    const retorno = await emitirNfe(ref, montado.payload);
    const nota = await salvarRetorno(ref, retorno);

    // Vínculo é um bônus de cadastro, não parte da emissão: nota autorizada
    // não pode virar erro porque o vínculo com o cliente falhou.
    if (clienteId) {
      try {
        // Sem documentoId: `cliente_veiculos.documento_id` referencia
        // documentos_gerados, não notas_fiscais — a nota não é um "documento
        // gerado" nesse sentido.
        await ligarVeiculo({
          clienteId,
          vehicleId,
          papel: "comprou",
          origem: "nota",
        });
      } catch (vinculoErr) {
        console.error("Falha ao ligar cliente ao veículo após emissão da nota:", vinculoErr);
      }
    }

    return { nota };
  } catch (err) {
    // Guarda a resposta INTEIRA da Focus, não só a mensagem: quando a recusa é
    // de schema, o motivo real está no detalhamento, e sem ele o diagnóstico
    // vira adivinhação. `err.focus` vem do cliente da Focus.
    const nota = await query(
      `update notas_fiscais set status='erro', mensagem=$2, raw=$3::jsonb where ref=$1 returning *`,
      [ref, String(err.message), JSON.stringify(err.focus ?? {})]
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
