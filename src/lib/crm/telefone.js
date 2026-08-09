/**
 * Número do WhatsApp do cliente, no formato que o wa.me exige: DDI + DDD +
 * número, só dígitos, sem "+".
 *
 * Puro de propósito (sem I/O e sem imports): usado tanto pela regra de
 * exibição (`acoesDaEtapa`, em etapas.js) quanto pela tela do card, e
 * direto no teste, que roda em `node --test`, onde o alias "@/" não resolve.
 *
 * Por que isso existe: `wa.me/34999887766` (DDD 34, de Uberlândia, sem DDI)
 * faz o WhatsApp ler "34" como código de país da Espanha — a conversa abre
 * errada, ou não abre. O wa.me exige DDI. Um telefone de 10 ou 11 dígitos
 * (DDD + fixo ou celular) não é ambíguo dentro do Brasil, então prefixamos
 * "55" (mesmo DDI cravado em WHATSAPP_NUMBER, em src/lib/whatsapp.js). Fora
 * desse formato não dá para adivinhar o DDI — devolve `null`, porque um
 * link errado é pior que nenhum link.
 */
export function telefoneWhatsapp(bruto) {
  const digitos = String(bruto ?? "").replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    return digitos;
  }
  return null;
}
