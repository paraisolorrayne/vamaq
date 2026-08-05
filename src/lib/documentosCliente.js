/**
 * Quem é a "outra parte" do documento — o cliente, do ponto de vista da Vamaq.
 * Cada modelo chama por um nome: na compra é o vendedor, na venda é o
 * comprador, na consignação e na vistoria é o proprietário do carro.
 *
 * Puro de propósito (sem I/O e sem imports): é usado tanto na tela quanto no
 * teste, que roda em `node --test`, onde o alias "@/" não resolve.
 */

const CAMPO_CLIENTE = {
  "compra-venda": "vendedor_nome",
  venda: "comprador_nome",
  consignacao: "proprietario_nome",
  "termo-vistoria": "proprietario_nome",
};

export function clienteDoDocumento(templateId, values) {
  const campo = CAMPO_CLIENTE[templateId];
  if (!campo || !values) return null;
  const nome = String(values[campo] ?? "").trim();
  return nome || null;
}
