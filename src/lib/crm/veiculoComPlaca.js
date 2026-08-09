/**
 * Veículo por extenso para a tela de registrar venda: marca, modelo, ano
 * (via rotuloVeiculo, já usado na lista e no card) e a placa, que só
 * importa aqui — é por isso que não entrou em rotuloVeiculo, que é usado
 * também na mensagem de WhatsApp do vendedor e não deveria carregar a
 * placa lá.
 *
 * Puro de propósito (sem I/O): usado pela tela de vender (a única
 * irreversível da entrega) e direto no teste, que roda em `node --test`,
 * onde o alias "@/" não resolve — por isso o import abaixo é relativo.
 */
import { rotuloVeiculo } from "./rotuloVeiculo.js";

export function veiculoComPlaca(o) {
  const base = rotuloVeiculo(o);
  if (!base) return "";
  return o.vehicle_placa ? `${base} — placa ${o.vehicle_placa}` : base;
}
