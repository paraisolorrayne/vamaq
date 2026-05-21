/**
 * Helpers de WhatsApp — puros, sem dependência de dados/DB.
 * Importáveis tanto em Server quanto em Client Components.
 */

export const WHATSAPP_NUMBER = '5534984143315';

export function getWhatsAppUrl(vehicle) {
  const msg = encodeURIComponent(
    `Olá! Vi o ${vehicle.brand} ${vehicle.model} ${vehicle.year} no site da Vamaq e tenho interesse.`
  );
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
}

export function getWhatsAppGenericUrl(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
