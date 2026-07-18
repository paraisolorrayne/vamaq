/**
 * Helpers de WhatsApp — puros, sem dependência de dados/DB.
 * Importáveis tanto em Server quanto em Client Components.
 */

// Plantão de vendas — manter sincronizado com BUSINESS.phone (src/lib/businessInfo.js)
export const WHATSAPP_NUMBER = '5534997353315';

export function getWhatsAppUrl(vehicle) {
  const msg = encodeURIComponent(
    `Olá! Vi o ${vehicle.brand} ${vehicle.model} ${vehicle.year} no site da Vamaq e tenho interesse.`
  );
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
}

export function getWhatsAppGenericUrl(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
