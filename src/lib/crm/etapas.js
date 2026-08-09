/**
 * Regras do funil do CRM: ordem das etapas, rótulos e quais ações a tela do
 * card oferece.
 *
 * Puro de propósito (sem I/O): é usado nas telas e no teste, que roda em
 * `node --test`, onde o alias "@/" não resolve — por isso o único import
 * daqui é relativo, com extensão, para outro módulo igualmente puro.
 *
 * `ganho` e `perdido` são terminais: saem do funil por caminhos próprios
 * (registrar venda / reabrir), não por "avançar".
 */
import { telefoneWhatsapp } from "./telefone.js";

export const ETAPAS_INFO = [
  { key: "novo", label: "Novo" },
  { key: "contato", label: "Em contato" },
  { key: "proposta", label: "Proposta" },
  { key: "negociacao", label: "Negociação" },
  { key: "ganho", label: "Ganho" },
  { key: "perdido", label: "Perdido" },
];

// A sequência que "Avançar" percorre. `perdido` fica de fora: é saída lateral.
const FUNIL = ["novo", "contato", "proposta", "negociacao", "ganho"];

export function proximaEtapa(etapa) {
  const i = FUNIL.indexOf(etapa);
  if (i < 0 || i >= FUNIL.length - 1) return null;
  return FUNIL[i + 1];
}

export function rotuloEtapa(etapa) {
  const e = ETAPAS_INFO.find((x) => x.key === etapa);
  return e ? e.label : String(etapa ?? "");
}

/** O que a tela do card oferece, dado o estado da oportunidade. */
export function acoesDaEtapa(oportunidade) {
  const o = oportunidade || {};
  const etapa = o.etapa;
  return {
    avancarPara: proximaEtapa(etapa),
    // Registrar venda exige veículo ligado: sem ele a ação falha no servidor,
    // e um botão que falha é pior que um botão ausente.
    podeVender: etapa === "ganho" && Boolean(o.vehicle_id),
    // `ganho` também sai daqui: negócio já ganho não se "perde" pelo botão
    // principal. O caso raro de venda que cai depois (ex.: financiamento
    // negado) passa pela tela "Mover", que oferece qualquer etapa — não por
    // este atalho. Exige etapa conhecida: sem oportunidade (ou sem etapa) não
    // há o que perder.
    podePerder: Boolean(etapa) && etapa !== "perdido" && etapa !== "ganho",
    podeReabrir: etapa === "perdido",
    // Presente não basta: "34999" (DDD sem DDI) faz o wa.me abrir a
    // conversa errada. Só oferece o botão quando dá para montar um link
    // que funcione — ver src/lib/crm/telefone.js.
    podeWhatsapp: Boolean(telefoneWhatsapp(o.telefone)),
  };
}
