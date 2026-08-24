"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import {
  atualizarStatus,
  cancelarNota,
  emitirNotaVeiculo,
  emitirNotaEntradaVeiculo,
  devolverConsignacaoVeiculo,
  emitirCartaCorrecao,
  registrarCancelamentoExterno,
} from "@/lib/fiscal/notas";

export async function atualizarStatusAction(ref) {
  await requireRole(["financeiro", "secretaria"]);
  const res = await atualizarStatus(ref);
  if (res.error) return { error: res.error };
  revalidatePath("/admin/fiscal");
  return { ok: true, status: res.nota.status };
}

export async function cancelarNotaAction(ref, justificativa) {
  await requireRole(["financeiro", "secretaria"]);
  const res = await cancelarNota(ref, justificativa);
  if (res.error) return { error: res.error };
  revalidatePath("/admin/fiscal");
  return { ok: true };
}

export async function emitirNotaAction(
  vehicleId,
  { destinatario, valorVenda, custoAquisicao, clienteId, numeroNotaEntrada, vendaPresencial }
) {
  await requireRole(["financeiro", "secretaria"]);
  const res = await emitirNotaVeiculo(vehicleId, {
    destinatario, valorVenda, custoAquisicao, clienteId, numeroNotaEntrada, vendaPresencial,
  });
  if (res.error) return { error: res.error };
  revalidatePath("/admin/fiscal");
  return { ok: true, ref: res.nota.ref, status: res.nota.status };
}

/**
 * Emite a nota de ENTRADA — compra de veículo de pessoa física.
 *
 * Ação separada da emissão de venda de propósito: são operações fiscais
 * diferentes (tpNF 0 × 1, CFOP 1102 × 5102, imposto zerado × destacado), e um
 * único ponto de entrada com um flag seria convite a emitir a errada.
 */
export async function emitirNotaEntradaAction(vehicleId, { remetente, valorAquisicao, consignacao }) {
  await requireRole(["financeiro", "secretaria"]);
  const res = await emitirNotaEntradaVeiculo(vehicleId, { remetente, valorAquisicao, consignacao });
  if (res.error) return { error: res.error };
  revalidatePath("/admin/fiscal");
  redirect("/admin/fiscal");
}

/**
 * Devolve ao dono um carro recebido em consignação que não vendeu (CFOP 5918).
 *
 * Não recebe dados: o consignante e o valor saem da própria nota de entrada,
 * onde já estão gravados. Pedir de novo é como o endereço da volta sai
 * diferente do da ida.
 */
export async function devolverConsignacaoAction(vehicleId) {
  await requireRole(["financeiro", "secretaria"]);
  const res = await devolverConsignacaoVeiculo(vehicleId);
  if (res.error) return { error: res.error };
  revalidatePath("/admin/fiscal");
  return { ok: true };
}

/**
 * Carta de correção — a saída para nota autorizada com erro em campo que não
 * determina imposto, especialmente depois de vencido o prazo de cancelamento.
 */
export async function cartaCorrecaoAction(ref, correcao) {
  await requireRole(["financeiro", "secretaria"]);
  const res = await emitirCartaCorrecao(ref, correcao);
  if (res.error) return { error: res.error };
  revalidatePath("/admin/fiscal");
  return { ok: true };
}

/**
 * Registra cancelamento feito pela contabilidade, fora do sistema.
 *
 * Sem isto a loja depende de suporte técnico para destravar a reemissão de um
 * veículo — que é tarefa de operação, não de quem escreveu o código.
 */
export async function registrarCancelamentoExternoAction(ref, { protocolo, confirmadoPor, justificativa }) {
  const usuario = await requireRole(["financeiro", "secretaria"]);
  const res = await registrarCancelamentoExterno(ref, {
    protocolo,
    confirmadoPor,
    justificativa,
    usuarioId: usuario?.id,
  });
  if (res.error) return { error: res.error };
  revalidatePath("/admin/fiscal");
  return { ok: true };
}
