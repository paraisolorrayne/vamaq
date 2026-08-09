/**
 * Mensagem e link de WhatsApp que o vendedor usa para chamar o cliente de
 * uma oportunidade (AcoesCard) — o inverso de `src/lib/whatsapp.js`, que
 * monta o link para o WhatsApp *da loja* (número fixo em WHATSAPP_NUMBER,
 * usado no site público: o cliente chamando a Vamaq). Não dá para
 * reaproveitar getWhatsAppUrl/getWhatsAppGenericUrl porque os dois cravam o
 * número da loja como destino.
 *
 * A normalização do telefone do cliente (DDI, para o wa.me não confundir
 * DDD com país) é a mesma usada por `acoesDaEtapa` (etapas.js) para decidir
 * se `podeWhatsapp` é `true` — quando `linkWhatsapp` é chamado, o número já
 * é garantidamente válido.
 *
 * Puro de propósito (sem I/O): usado pelo AcoesCard e direto no teste, que
 * roda em `node --test`, onde o alias "@/" não resolve — por isso os
 * imports abaixo são relativos.
 */
import { telefoneWhatsapp } from "./telefone.js";
import { rotuloVeiculo } from "./rotuloVeiculo.js";

export function mensagemWhatsapp(o) {
  const primeiroNome = (o.cliente_nome || "").trim().split(/\s+/)[0] || "";
  const saudacao = primeiroNome ? `Olá, ${primeiroNome}!` : "Olá!";
  const veiculo = rotuloVeiculo(o) || null;
  return veiculo
    ? `${saudacao} Aqui é da Vamaq Motors, sobre o ${veiculo} que você está negociando com a gente — podemos continuar?`
    : `${saudacao} Aqui é da Vamaq Motors, tudo bem? Vamos continuar o seu atendimento.`;
}

export function linkWhatsapp(o) {
  const numero = telefoneWhatsapp(o.telefone);
  const texto = encodeURIComponent(mensagemWhatsapp(o));
  return `https://wa.me/${numero}?text=${texto}`;
}
