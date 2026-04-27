import vehicleData from "./vehicles.json";

export const vehicles = vehicleData;

// --- Service functions ---

export function getAllVehicles(filters = {}) {
  let result = [...vehicles];

  if (filters.brand?.length) {
    const brands = Array.isArray(filters.brand) ? filters.brand : [filters.brand];
    result = result.filter(v => brands.includes(v.brand));
  }
  if (filters.bodyType?.length) {
    const types = Array.isArray(filters.bodyType) ? filters.bodyType : [filters.bodyType];
    result = result.filter(v => types.includes(v.bodyType));
  }
  if (filters.fuel?.length) {
    const fuels = Array.isArray(filters.fuel) ? filters.fuel : [filters.fuel];
    result = result.filter(v => fuels.includes(v.fuel));
  }
  if (filters.armored !== undefined) {
    if (filters.armored === true) result = result.filter(v => v.blindagem?.blindado === true);
    else if (filters.armored === false) result = result.filter(v => !v.blindagem?.blindado);
  }
  if (filters.minYear) result = result.filter(v => v.year >= filters.minYear);
  if (filters.maxYear) result = result.filter(v => v.year <= filters.maxYear);
  if (filters.maxQuilometragem) result = result.filter(v => v.quilometragem <= filters.maxQuilometragem);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(v => `${v.brand} ${v.model} ${v.color}`.toLowerCase().includes(q));
  }

  return result;
}

export function getFeaturedVehicles(limit = 6) {
  return vehicles.filter(v => v.featured).slice(0, limit);
}

export function getVehicleBySlug(slug) {
  return vehicles.find(v => v.slug === slug) || null;
}

export function getRelatedVehicles(vehicle, limit = 3) {
  return vehicles
    .filter(v => v.slug !== vehicle.slug && (v.brand === vehicle.brand || v.bodyType === vehicle.bodyType))
    .slice(0, limit);
}

export function getBrands() {
  return [...new Set(vehicles.map(v => v.brand))].sort();
}

export function getBodyTypes() {
  return [...new Set(vehicles.map(v => v.bodyType))].sort();
}

export function getFuelTypes() {
  return [...new Set(vehicles.map(v => v.fuel))].sort();
}

export function sortVehicles(list, sortBy) {
  const sorted = [...list];
  switch (sortBy) {
    case 'recent': return sorted.sort((a, b) => b.year - a.year);
    case 'quilometragem': return sorted.sort((a, b) => a.quilometragem - b.quilometragem);
    case 'brand': return sorted.sort((a, b) => a.brand.localeCompare(b.brand));
    default: return sorted;
  }
}

export const WHATSAPP_NUMBER = '5511999999999';

export function getWhatsAppUrl(vehicle) {
  const msg = encodeURIComponent(
    `Olá! Vi o ${vehicle.brand} ${vehicle.model} ${vehicle.year} no site da Vamaq e tenho interesse.`
  );
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
}

export function getWhatsAppGenericUrl(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
