/**
 * Rótulo do veículo de uma oportunidade: "Marca Modelo 2021/2022".
 *
 * Puro de propósito (sem I/O): a montagem — marca, modelo e ano via
 * anoVeiculo — repetia com pequenas variações em três lugares (lista do
 * CRM, ficha da oportunidade e mensagem de WhatsApp do vendedor). Extraído
 * para não divergir de novo.
 *
 * Devolve "" quando não há veículo ligado (sem `vehicle_brand`); cada
 * chamador decide o texto de ausência — "sem veículo" na lista, "—" na
 * ficha, nada na mensagem de WhatsApp.
 */
import { anoVeiculo } from "../anoVeiculo.js";

export function rotuloVeiculo(oportunidade) {
  const o = oportunidade || {};
  if (!o.vehicle_brand) return "";
  const ano = anoVeiculo({ year: o.vehicle_year, ano_modelo: o.vehicle_ano_modelo });
  return [o.vehicle_brand, o.vehicle_model, ano].filter(Boolean).join(" ");
}
