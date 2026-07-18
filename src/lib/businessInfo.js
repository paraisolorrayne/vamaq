// Dados do negócio — fonte única de verdade.
// Atualize aqui e todo o site (footer, contato, FAQ, contratos) acompanha.

export const BUSINESS = {
  name: "VAMAQ MOTORS",
  legalName: "VAMAQ MOTORS LTDA.",
  // Dados cadastrais (usados em contratos/documentos)
  razaoSocial: "Mateus Parreira Sousa",
  tradeName: "Vamaq Motors",
  cnpj: "45.348.469/0001-54",
  representante: "Mateus Parreira Sousa",
  // Plantão de vendas — celular, também usado no WhatsApp (ver src/lib/whatsapp.js)
  phone: "(34) 99735-3315",
  phoneE164: "+5534997353315",
  // Telefone fixo
  landline: "(34) 3046-4252",
  landlineE164: "+553430464252",
  email: "contato@vamaqmotors.com.br",
  address: {
    street: "Av. Francisco Galassi",
    number: "1434",
    neighborhood: "Copacabana",
    city: "Uberlândia",
    state: "MG",
    zip: "38411-108",
    // Endereço completo formatado para exibição
    full: "Av. Francisco Galassi, 1434 - Copacabana, Uberlândia - MG, 38411-108",
  },
  hours: {
    weekdays: "Seg a Sex: 9h - 18h",
    saturday: "Sáb: 9h - 14h",
  },
};

// URL para abrir o local no Google Maps
export const MAPS_QUERY_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  BUSINESS.address.full
)}`;

// URL de embed (iframe) do Google Maps, sem necessidade de API key
export const MAPS_EMBED_URL = `https://maps.google.com/maps?q=${encodeURIComponent(
  BUSINESS.address.full
)}&output=embed`;
