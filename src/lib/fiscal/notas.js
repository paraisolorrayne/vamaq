/**
 * Emissão de NF-e do veículo: orquestra o payload, a Focus e o espelho local.
 * Server-only. Só admin e financeiro chegam aqui (ver as Server Actions).
 */
import { randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import {
  montarPayloadNfe,
  montarPayloadEntrada,
  montarPayloadDevolucaoConsignacao,
} from "@/lib/fiscal/payload";
import { focusEnabled, emitirNfe, consultarNfe, cancelarNfe, cartaCorrecaoNfe, focusFileUrl, baixarArquivo } from "@/lib/fiscal/focus/client";
import { criarZip } from "@/lib/fiscal/zip";
import { SQL_NOTAS_DO_MES, nomeDoArquivo, nomeDoZip, relatorioDeFaltando } from "@/lib/fiscal/pacote";
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

  // SÓ SAÍDA. Sem este filtro, a nota de ENTRADA do carro apareceria como
  // "este veículo já tem nota fiscal" na tela de venda — ou seja, emitir a
  // entrada (que é o passo obrigatório) travaria a venda do mesmo carro. Um
  // veículo tem as duas notas por definição.
  const { rows: notasAtivas } = await query(
    `select ref, status from notas_fiscais
      where vehicle_id = $1 and operacao = 'saida' and status in ('processando','autorizada')
      order by created_at desc limit 1`,
    [vehicleId]
  );

  // O número da nota de ENTRADA emitida pelo próprio sistema. O texto
  // obrigatório da nota de venda cita esse número, e digitá-lo à mão é onde a
  // ligação entre as duas notas se perde por um dígito trocado.
  const { rows: entrada } = await query(
    `select numero from notas_fiscais
      where vehicle_id = $1 and operacao = 'entrada' and status = 'autorizada'
        and numero is not null
      order by created_at desc limit 1`,
    [vehicleId]
  );

  return {
    veiculo: v.rows[0],
    config: await getFiscalConfig(),
    custoAquisicao,
    custoOrigem,
    notaExistente: notasAtivas[0] || null,
    numeroNotaEntrada: entrada[0]?.numero || "",
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
  // Por OPERAÇÃO: um carro tem uma nota de entrada (quando comprado de pessoa
  // física) e uma de saída. Sem este filtro, a entrada recém-emitida bloquearia
  // a venda do mesmo carro.
  const { rows: existentes } = await query(
    `select ref, status from notas_fiscais
      where vehicle_id=$1 and operacao='saida' and status in ('processando','autorizada')`,
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
      `insert into notas_fiscais (ref, vehicle_id, status, valor, destinatario, serie, cliente_id, operacao, cfop)
       values ($1,$2,'processando',$3,$4::jsonb,$5,$6,'saida',$7)`,
      [
        ref, vehicleId, Number(valorVenda), JSON.stringify(destinatario),
        String(dados.config.serie), clienteId || null,
        montado.payload.items[0].cfop,
      ]
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

/** Uma nota pelo identificador de emissão — o suficiente para servir o XML. */
export async function getNotaPorRef(ref) {
  const { rows } = await query(
    `select ref, numero, serie, chave, status, operacao, xml_url, danfe_url
       from notas_fiscais where ref = $1`,
    [ref]
  );
  return rows[0] || null;
}

/**
 * Monta o pacote de XMLs de um mês — o que a loja manda para a contabilidade.
 *
 * POR QUE EXISTE: o contador pede todos os XMLs de entrada e saída do mês. Um
 * a um, no navegador, são dezenas de cliques — e o botão de XML nem salvava o
 * arquivo, abria o código na tela.
 *
 * Uma nota que não baixa NÃO derruba o pacote: ela vira linha no `_faltando.txt`
 * lá dentro. Pacote incompleto e silencioso é pior que pacote com bilhete.
 */
export async function montarPacoteXmlDoMes(ano, mes) {
  const { rows: notas } = await query(SQL_NOTAS_DO_MES, [ano, mes]);
  if (!notas.length) return { vazio: true };

  const arquivos = [];
  const faltando = [];

  // Em blocos: sequencial demora demais num mês cheio, e tudo de uma vez é
  // enxurrada de conexão na Focus por causa de um clique.
  const LOTE = 5;
  for (let i = 0; i < notas.length; i += LOTE) {
    const bloco = notas.slice(i, i + LOTE);
    await Promise.all(
      bloco.map(async (nota) => {
        try {
          const conteudo = await baixarArquivo(nota.xml_url);
          arquivos.push({ nome: nomeDoArquivo(nota), conteudo });
        } catch (err) {
          // TimeoutError vem sem mensagem útil ("The operation was aborted");
          // o contador precisa ler "tempo esgotado" e entender.
          const motivo =
            err.name === "TimeoutError" ? "tempo esgotado" : String(err.message);
          console.error(`Pacote de XMLs: falha ao baixar a nota ${nota.ref}:`, err);
          faltando.push({ numero: nota.numero, operacao: nota.operacao, motivo });
        }
      })
    );
  }

  const relatorio = relatorioDeFaltando(faltando);
  if (relatorio) arquivos.push({ nome: "_faltando.txt", conteudo: relatorio });

  return {
    zip: criarZip(arquivos),
    nome: nomeDoZip(ano, mes),
    total: notas.length,
    baixadas: notas.length - faltando.length,
    faltando: faltando.length,
  };
}

/**
 * Emite a NF-e de ENTRADA de um veículo comprado de pessoa física.
 *
 * É o passo que hoje trava a operação: o texto obrigatório da nota de VENDA
 * cita o número da nota de ENTRADA, então enquanto a entrada depender do
 * escritório, nenhuma venda sai. Ver montarPayloadEntrada().
 *
 * A guarda é por operação: um carro pode ter entrada E saída. O que não pode é
 * ter duas entradas.
 */
export async function emitirNotaEntradaVeiculo(
  vehicleId,
  { remetente, valorAquisicao, consignacao = false }
) {
  if (!focusEnabled()) return { error: "Emissor fiscal não configurado." };

  const dados = await getDadosEmissao(vehicleId);
  if (!dados) return { error: "Veículo não encontrado." };
  if (!dados.config) return { error: "Parâmetros fiscais não cadastrados. Peça ao contador." };

  // Diferente da saída, a entrada NÃO exige veículo vendido — ela acontece na
  // compra, com o carro entrando no estoque.
  const { rows: existentes } = await query(
    `select ref, status from notas_fiscais
      where vehicle_id=$1 and operacao='entrada' and status in ('processando','autorizada')`,
    [vehicleId]
  );
  if (existentes.length) {
    return {
      error:
        existentes[0].status === "processando"
          ? "A nota de entrada deste veículo já foi enviada e está sendo autorizada pela SEFAZ. Aguarde alguns segundos — não emita de novo."
          : "Este veículo já tem nota de entrada autorizada. Cancele a atual antes de emitir outra.",
    };
  }

  const montado = montarPayloadEntrada({
    config: dados.config,
    veiculo: dados.veiculo,
    remetente,
    valorAquisicao,
    consignacao,
  });
  if (montado.error) return { error: montado.error };

  const ref = `vamaq-ent-${randomUUID()}`;
  await query(
    `insert into notas_fiscais (ref, vehicle_id, status, valor, destinatario, serie, operacao, cfop)
     values ($1,$2,'processando',$3,$4::jsonb,$5,'entrada',$6)`,
    [
      ref,
      vehicleId,
      Number(valorAquisicao),
      JSON.stringify(remetente),
      String(dados.config.serie),
      // Grava o CFOP EMITIDO, não o da config: é ele que diz depois se esta
      // entrada foi compra (1102) ou consignação (1917) — e só a consignação
      // pode ser devolvida. A config muda com o tempo; a nota emitida não.
      montado.payload.items[0].cfop,
    ]
  );

  try {
    const retorno = await emitirNfe(ref, montado.payload);
    return { nota: await salvarRetorno(ref, retorno) };
  } catch (err) {
    const { rows } = await query(
      `update notas_fiscais set status='erro', mensagem=$2, raw=$3::jsonb where ref=$1 returning *`,
      [ref, String(err.message), JSON.stringify(err.focus ?? {})]
    );
    return { nota: rows[0], error: err.message };
  }
}

/**
 * Consignações que ainda estão com a Vamaq — carro recebido do dono, nem
 * vendido nem devolvido. É a lista de quem pode ser devolvido.
 *
 * Filtra pelos CFOP GRAVADOS na nota, não pela config: se o contador mudar o
 * parâmetro amanhã, as consignações de ontem continuam sendo consignações.
 *
 * OS DOIS CFOP, não um: 1917 é consignação recebida de dentro do estado, 2917
 * de fora. Filtrar só por 1917 fazia o carro vindo de outro estado — como o
 * Audi Q5 de Catalão/GO — nunca aparecer para devolver, e ninguém descobriria
 * até precisar devolvê-lo.
 */
export const CFOP_CONSIGNACAO_RECEBIDA = ["1917", "2917"];

export async function listConsignacoesAbertas() {
  const { rows } = await query(
    `select n.vehicle_id, n.ref, n.valor, n.destinatario, n.numero, n.created_at,
            v.brand, v.model, v.year, v.placa
       from notas_fiscais n
       join vehicles v on v.id = n.vehicle_id
      where n.operacao = 'entrada'
        and n.status = 'autorizada'
        and n.cfop = any($1)
        and not exists (
          select 1 from notas_fiscais d
           where d.vehicle_id = n.vehicle_id
             and d.operacao = 'devolucao'
             and d.status in ('processando','autorizada')
        )
      order by n.created_at desc`,
    [CFOP_CONSIGNACAO_RECEBIDA]
  );
  return rows.map((r) => ({ ...r, valor: r.valor != null ? Number(r.valor) : 0 }));
}

/**
 * Devolve ao dono um veículo recebido em consignação que não vendeu.
 *
 * O consignante e o valor NÃO são pedidos de novo: saem da própria nota de
 * entrada, onde ficaram gravados. Redigitar oito campos de endereço para
 * devolver um carro é como o endereço da volta sai diferente do da ida.
 */
export async function devolverConsignacaoVeiculo(vehicleId) {
  if (!focusEnabled()) return { error: "Emissor fiscal não configurado." };

  const dados = await getDadosEmissao(vehicleId);
  if (!dados) return { error: "Veículo não encontrado." };
  if (!dados.config) return { error: "Parâmetros fiscais não cadastrados. Peça ao contador." };

  const { rows: entradas } = await query(
    `select ref, valor, destinatario from notas_fiscais
      where vehicle_id=$1 and operacao='entrada' and status='autorizada'
        and cfop = any($2)
      order by created_at desc limit 1`,
    [vehicleId, CFOP_CONSIGNACAO_RECEBIDA]
  );
  if (!entradas.length) {
    return {
      error:
        "Este veículo não tem nota de entrada de consignação autorizada. A devolução só existe para carro que entrou em consignação.",
    };
  }

  const { rows: jaDevolvido } = await query(
    `select status from notas_fiscais
      where vehicle_id=$1 and operacao='devolucao' and status in ('processando','autorizada')
      limit 1`,
    [vehicleId]
  );
  if (jaDevolvido.length) {
    return {
      error:
        jaDevolvido[0].status === "processando"
          ? "A devolução deste veículo já foi enviada e está sendo autorizada pela SEFAZ. Aguarde alguns segundos — não emita de novo."
          : "Este veículo já foi devolvido ao dono.",
    };
  }

  const consignante = entradas[0].destinatario || {};
  const montado = montarPayloadDevolucaoConsignacao({
    config: dados.config,
    veiculo: dados.veiculo,
    consignante,
    valor: Number(entradas[0].valor) || 0,
  });
  if (montado.error) return { error: montado.error };

  const ref = `vamaq-dev-${randomUUID()}`;
  await query(
    `insert into notas_fiscais (ref, vehicle_id, status, valor, destinatario, serie, operacao, cfop)
     values ($1,$2,'processando',$3,$4::jsonb,$5,'devolucao',$6)`,
    [
      ref,
      vehicleId,
      Number(entradas[0].valor) || 0,
      JSON.stringify(consignante),
      String(dados.config.serie),
      montado.payload.items[0].cfop,
    ]
  );

  try {
    const retorno = await emitirNfe(ref, montado.payload);
    return { nota: await salvarRetorno(ref, retorno) };
  } catch (err) {
    const { rows } = await query(
      `update notas_fiscais set status='erro', mensagem=$2, raw=$3::jsonb where ref=$1 returning *`,
      [ref, String(err.message), JSON.stringify(err.focus ?? {})]
    );
    return { nota: rows[0], error: err.message };
  }
}

/**
 * Envia uma carta de correção para uma nota autorizada.
 *
 * Só faz sentido em nota AUTORIZADA: em nota com erro a saída é reemitir, e em
 * cancelada não há o que corrigir. Recusar aqui evita uma ida à SEFAZ que
 * voltaria com mensagem que ninguém na loja entende.
 */
export async function emitirCartaCorrecao(ref, correcao) {
  if (!focusEnabled()) return { error: "Emissor fiscal não configurado." };

  const { rows } = await query(
    `select ref, status, numero from notas_fiscais where ref = $1`,
    [ref]
  );
  if (!rows.length) return { error: "Nota não encontrada." };
  if (rows[0].status !== "autorizada") {
    return {
      error:
        rows[0].status === "cancelada"
          ? "Esta nota foi cancelada — não há o que corrigir."
          : "A carta de correção só vale para nota autorizada. Esta ainda não foi.",
    };
  }

  try {
    const retorno = await cartaCorrecaoNfe(ref, correcao);
    const { rows: atualizada } = await query(
      `update notas_fiscais
          set carta_correcao = $2,
              carta_correcao_em = now(),
              carta_correcao_qtd = carta_correcao_qtd + 1,
              raw = $3::jsonb
        where ref = $1
        returning *`,
      [ref, String(correcao).trim(), JSON.stringify(retorno ?? {})]
    );
    return { nota: atualizada[0] };
  } catch (err) {
    return { error: err.message };
  }
}

/** Protocolo da SEFAZ: 15 dígitos. Formato é o que dá para conferir daqui. */
const PROTOCOLO_VALIDO = /^\d{15}$/;

/**
 * Registra que uma nota foi cancelada FORA do sistema.
 *
 * Acontece quando a contabilidade cancela pelo sistema dela — inclusive o
 * cancelamento fora do prazo, que a loja não consegue fazer sozinha. Sem isto,
 * o nosso registro fica em "autorizada" para sempre e a guarda bloqueia a
 * reemissão do veículo, obrigando a loja a chamar suporte técnico para uma
 * tarefa que é de operação.
 *
 * EXIGE O PROTOCOLO, e não é burocracia: é a única prova de que a SEFAZ
 * registrou o cancelamento. Sem ele, marcar como cancelada é palpite — e o
 * preço do palpite errado é duas notas válidas para o mesmo carro.
 */
export async function registrarCancelamentoExterno(
  ref,
  { protocolo, confirmadoPor, justificativa, usuarioId }
) {
  // DOIS CAMINHOS, DE PROPÓSITO. O protocolo é a prova melhor, mas exigir só
  // ele travava quem tinha a confirmação da contabilidade por telefone e não
  // tinha o número — e operadora travada liga para o suporte, que é o que
  // este caminho existe para evitar.
  //
  // Sendo honesto: o protocolo não verifica nada, porque ninguém confere
  // contra a SEFAZ. Ele registra, e obriga a buscar algo concreto antes de
  // clicar. Vale — mas não vale bloquear.
  const proto = String(protocolo ?? "").replace(/\D/g, "");
  const quem = String(confirmadoPor ?? "").trim();

  let evidencia;
  if (proto) {
    // A chave de acesso tem 44 e é o número grande impresso no topo da DANFE —
    // é a confusão mais provável, e dizer isso poupa a pessoa de conferir
    // dígito por dígito o que ela colou.
    if (proto.length === 44) {
      return {
        error:
          "Isso é a chave de acesso da nota (44 números), não o protocolo do cancelamento. O protocolo tem 15 números e é o que a contabilidade recebe da SEFAZ ao cancelar. Se não tiver esse número, deixe o campo em branco e informe quem confirmou.",
      };
    }
    if (!PROTOCOLO_VALIDO.test(proto)) {
      return {
        error: `Você informou ${proto.length} ${proto.length === 1 ? "número" : "números"} e o protocolo do cancelamento tem 15. Se não tiver esse número em mãos, deixe o campo em branco e informe quem da contabilidade confirmou — funciona igual.`,
      };
    }
    evidencia = "protocolo";
  } else if (quem.length >= 3) {
    evidencia = "confirmacao";
  } else {
    return {
      error:
        "Informe o protocolo do cancelamento (15 números) ou, se não tiver, quem da contabilidade confirmou que a SEFAZ aceitou.",
    };
  }

  const motivo = String(justificativa ?? "").trim();
  if (motivo.length < 15) {
    return { error: "Escreva em poucas palavras por que a nota foi cancelada (mínimo 15 caracteres)." };
  }

  const { rows: atual } = await query(
    `select status from notas_fiscais where ref = $1`,
    [ref]
  );
  if (!atual.length) return { error: "Nota não encontrada." };
  if (atual[0].status === "cancelada") {
    return { error: "Esta nota já consta como cancelada." };
  }
  if (atual[0].status !== "autorizada") {
    return { error: "Só nota autorizada pode ser marcada como cancelada." };
  }

  const { rows } = await query(
    `update notas_fiscais
        set status = 'cancelada',
            cancelada_em = now(),
            cancelamento_externo = true,
            cancelamento_protocolo = $2,
            justificativa_cancelamento = $3,
            cancelamento_informado_por = $4,
            cancelamento_evidencia = $5,
            cancelamento_confirmado_por = $6
      where ref = $1
      returning *`,
    [ref, proto || null, motivo, usuarioId || null, evidencia, quem || null]
  );
  return { nota: rows[0] };
}

/**
 * Os dados de uma nota cancelada, para reemitir sem digitar tudo de novo.
 *
 * PORQUE NÃO É "DO ZERO": a nota guarda quem era a outra parte, o valor e o
 * CFOP emitido. Depois de um cancelamento — que quase sempre acontece por um
 * detalhe errado, não porque o negócio mudou —, pedir que a operadora
 * redigite oito campos de endereço é convidar a um erro novo, diferente do
 * primeiro.
 *
 * Só devolve para nota CANCELADA: reaproveitar de uma nota viva seria
 * duplicar, não refazer.
 */
export async function dadosParaRefazer(ref) {
  const { rows } = await query(
    `select ref, vehicle_id, status, operacao, cfop, valor, destinatario, numero
       from notas_fiscais where ref = $1`,
    [ref]
  );
  if (!rows.length) return null;
  const n = rows[0];
  if (n.status !== "cancelada") return null;

  return {
    ref: n.ref,
    numeroAnterior: n.numero,
    vehicleId: n.vehicle_id,
    operacao: n.operacao,
    // O CFOP gravado é o que diz se aquela entrada foi compra ou consignação.
    consignacao: CFOP_CONSIGNACAO_RECEBIDA.includes(String(n.cfop)),
    valor: n.valor != null ? Number(n.valor) : 0,
    contraparte: n.destinatario || {},
  };
}
