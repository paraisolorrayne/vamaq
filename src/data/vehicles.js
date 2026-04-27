export const vehicles = [
  {
    id: "vamaq-001",
    brand: "Porsche",
    model: "911 Carrera GTS",
    year: 2024,
    price: null,
    quilometragem: 3200,
    fuel: "Gasolina",
    transmission: "Automático",
    power: "480 cv",
    color: "Preto",
    bodyType: "Coupé",
    featured: true,
    badge: "Novo",
    images: { main: "/images/vehicles/porsche-911-main.jpg", gallery: [] },
    specs: { engine: "3.0 Biturbo Boxer", acceleration: "3.4s (0-100km/h)", topSpeed: "312 km/h", doors: 2, seats: 4 },
    description: "O ícone reinventado. O 911 Carrera GTS combina a alma esportiva clássica da Porsche com desempenho de pista, entregando 480 cv de pura adrenalina em um pacote refinado para o dia a dia.",
    opcionais: ["Teto Solar Panorâmico", "Bancos Ventilados", "Sistema de Som Bose", "Pacote Sport Chrono"],
    blindagem: { blindado: false, tipo: "" },
    slug: "porsche-911-carrera-gts-2024"
  },
  {
    id: "vamaq-002",
    brand: "BMW",
    model: "M4 Competition",
    year: 2024,
    price: null,
    quilometragem: 8500,
    fuel: "Gasolina",
    transmission: "Automático",
    power: "510 cv",
    color: "Cinza Brooklyn",
    bodyType: "Coupé",
    featured: true,
    badge: "Destaque",
    images: { main: "/images/vehicles/bmw-m4-main.jpg", gallery: [] },
    specs: { engine: "3.0 Biturbo Inline-6", acceleration: "3.9s (0-100km/h)", topSpeed: "290 km/h", doors: 2, seats: 4 },
    description: "Performance sem concessões. O M4 Competition entrega a experiência M em sua forma mais pura, com motor biturbo de 510 cv e tração integral M xDrive.",
    opcionais: ["Head-Up Display", "Harman Kardon", "Teto em Carbono", "M Sport Exhaust"],
    blindagem: { blindado: false, tipo: "" },
    slug: "bmw-m4-competition-2024"
  },
  {
    id: "vamaq-003",
    brand: "Mercedes-AMG",
    model: "GT 63 S",
    year: 2023,
    price: null,
    quilometragem: 12000,
    fuel: "Gasolina",
    transmission: "Automático",
    power: "639 cv",
    color: "Branco Designo",
    bodyType: "Coupé",
    featured: true,
    badge: null,
    images: { main: "/images/vehicles/amg-gt63-main.jpg", gallery: [] },
    specs: { engine: "4.0 V8 Biturbo", acceleration: "3.2s (0-100km/h)", topSpeed: "315 km/h", doors: 4, seats: 4 },
    description: "A mais potente expressão do DNA AMG. O GT 63 S combina o conforto de um gran turismo com a brutalidade de 639 cv do V8 biturbo.",
    opcionais: ["Pacote AMG Night", "Bancos Massageadores", "Burmester 3D Sound"],
    blindagem: { blindado: false, tipo: "" },
    slug: "mercedes-amg-gt-63-s-2023"
  },
  {
    id: "vamaq-004",
    brand: "Ferrari",
    model: "F8 Tributo",
    year: 2023,
    price: null,
    quilometragem: 4800,
    fuel: "Gasolina",
    transmission: "Automático",
    power: "720 cv",
    color: "Rosso Corsa",
    bodyType: "Coupé",
    featured: true,
    badge: "Destaque",
    images: { main: "/images/vehicles/ferrari-f8-main.jpg", gallery: [] },
    specs: { engine: "3.9 V8 Biturbo", acceleration: "2.9s (0-100km/h)", topSpeed: "340 km/h", doors: 2, seats: 2 },
    description: "Uma homenagem ao motor V8 mais premiado da história. A F8 Tributo é a expressão máxima da engenharia Ferrari, com 720 cv e aerodinâmica derivada da F1.",
    opcionais: ["Lifting System", "Carbono Exterior", "Câmeras 360°"],
    blindagem: { blindado: false, tipo: "" },
    slug: "ferrari-f8-tributo-2023"
  },
  {
    id: "vamaq-005",
    brand: "Lamborghini",
    model: "Huracán EVO",
    year: 2023,
    price: null,
    quilometragem: 6200,
    fuel: "Gasolina",
    transmission: "Automático",
    power: "640 cv",
    color: "Verde Mantis",
    bodyType: "Coupé",
    featured: true,
    badge: null,
    images: { main: "/images/vehicles/huracan-evo-main.jpg", gallery: [] },
    specs: { engine: "5.2 V10 Aspirado", acceleration: "2.9s (0-100km/h)", topSpeed: "325 km/h", doors: 2, seats: 2 },
    description: "O rugido do V10 aspirado mais emocionante do mundo. O Huracán EVO representa a essência Lamborghini com tecnologia de ponta e desempenho visceral.",
    opcionais: ["Sensonum Sound", "Câmeras 360°", "Pintura Especial"],
    blindagem: { blindado: false, tipo: "" },
    slug: "lamborghini-huracan-evo-2023"
  },
  {
    id: "vamaq-006",
    brand: "Range Rover",
    model: "Sport SVR",
    year: 2024,
    price: null,
    quilometragem: 15000,
    fuel: "Gasolina",
    transmission: "Automático",
    power: "575 cv",
    color: "Cinza Eiger",
    bodyType: "SUV",
    featured: true,
    badge: "Blindado",
    images: { main: "/images/vehicles/rr-sport-svr-main.jpg", gallery: [] },
    specs: { engine: "5.0 V8 Supercharged", acceleration: "4.5s (0-100km/h)", topSpeed: "283 km/h", doors: 4, seats: 5 },
    description: "O SUV mais rápido da Range Rover, agora com blindagem NÍVEL III-A. Combina luxo absoluto, capacidade off-road e desempenho de superesportivo.",
    opcionais: ["Teto Panorâmico", "Pacote Off-Road", "TV Digital", "Geladeira Traseira"],
    blindagem: { blindado: true, tipo: "Nível III-A" },
    slug: "range-rover-sport-svr-2024"
  },
  {
    id: "vamaq-007",
    brand: "Audi",
    model: "RS e-tron GT",
    year: 2024,
    price: null,
    quilometragem: 2100,
    fuel: "Elétrico",
    transmission: "Automático",
    power: "646 cv",
    color: "Cinza Daytona",
    bodyType: "Sedan",
    featured: false,
    badge: "Novo",
    images: { main: "/images/vehicles/audi-rs-etron-main.jpg", gallery: [] },
    specs: { engine: "Dual Motor Elétrico", acceleration: "3.3s (0-100km/h)", topSpeed: "250 km/h", doors: 4, seats: 4 },
    description: "O futuro da performance é elétrico. O RS e-tron GT entrega 646 cv de torque instantâneo em um design que define a nova era da Audi Sport.",
    opcionais: [],
    blindagem: { blindado: false, tipo: "" },
    slug: "audi-rs-etron-gt-2024"
  },
  {
    id: "vamaq-008",
    brand: "McLaren",
    model: "720S",
    year: 2022,
    price: null,
    quilometragem: 9800,
    fuel: "Gasolina",
    transmission: "Automático",
    power: "720 cv",
    color: "Papaya Spark",
    bodyType: "Coupé",
    featured: false,
    badge: null,
    images: { main: "/images/vehicles/mclaren-720s-main.jpg", gallery: [] },
    specs: { engine: "4.0 V8 Biturbo", acceleration: "2.9s (0-100km/h)", topSpeed: "341 km/h", doors: 2, seats: 2 },
    description: "Engenharia de F1 para as ruas. A 720S é uma obra-prima aerodinâmica que dissolve a fronteira entre carro de rua e máquina de corrida.",
    opcionais: [],
    blindagem: { blindado: false, tipo: "" },
    slug: "mclaren-720s-2022"
  },
  {
    id: "vamaq-009",
    brand: "Porsche",
    model: "Cayenne Turbo GT",
    year: 2024,
    price: null,
    quilometragem: 7500,
    fuel: "Gasolina",
    transmission: "Automático",
    power: "640 cv",
    color: "Azul Gentian",
    bodyType: "SUV",
    featured: false,
    badge: null,
    images: { main: "/images/vehicles/cayenne-turbo-gt-main.jpg", gallery: [] },
    specs: { engine: "4.0 V8 Biturbo", acceleration: "3.3s (0-100km/h)", topSpeed: "300 km/h", doors: 4, seats: 5 },
    description: "O SUV mais rápido de Nürburgring. O Cayenne Turbo GT leva a filosofia esportiva da Porsche ao formato familiar, sem perder um grama de emoção.",
    opcionais: [],
    blindagem: { blindado: false, tipo: "" },
    slug: "porsche-cayenne-turbo-gt-2024"
  },
  {
    id: "vamaq-010",
    brand: "BMW",
    model: "M8 Competition",
    year: 2023,
    price: null,
    quilometragem: 11200,
    fuel: "Gasolina",
    transmission: "Automático",
    power: "625 cv",
    color: "Verde British Racing",
    bodyType: "Coupé",
    featured: false,
    badge: null,
    images: { main: "/images/vehicles/bmw-m8-main.jpg", gallery: [] },
    specs: { engine: "4.4 V8 Biturbo", acceleration: "3.2s (0-100km/h)", topSpeed: "305 km/h", doors: 2, seats: 4 },
    description: "O gran turismo definitivo da BMW M. O M8 Competition combina luxo absoluto com desempenho brutal, entregando 625 cv em uma carroceria de tirar o fôlego.",
    opcionais: [],
    blindagem: { blindado: false, tipo: "" },
    slug: "bmw-m8-competition-2023"
  }
];

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
