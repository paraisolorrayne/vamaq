/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // O otimizador ficou DESLIGADO desde o commit inicial (abril/2026), sem
    // motivo registrado — e o site é de fotografia de carro. O custo medido
    // em 11/09/2026: a home servia ~2,5 MB de imagem em tamanho integral,
    // igual no desktop e no celular, sem srcset e sem width/height.
    //
    // O sharp já é dependência e o app roda `next start` na VPS, então o
    // otimizador funciona sem nada a mais. Ele transforma sob demanda e
    // guarda em .next/cache/images — a primeira requisição de cada tamanho
    // custa CPU, as seguintes saem do cache.

    // AVIF primeiro (comprime bem melhor que WebP em foto), WebP como queda
    // para quem não suporta. A ordem importa: é o primeiro match do header
    // Accept que vale. AVIF custa mais CPU para codificar — aceitável porque
    // acontece uma vez por tamanho, não por visita.
    formats: ["image/avif", "image/webp"],

    // No Next 16 este campo passou a ser restrito: sem allowlist, só 75 é
    // aceito e qualquer outro valor responde 400. Declarado explicitamente
    // para que mudar a qualidade seja uma decisão visível, não uma surpresa
    // em produção.
    qualities: [75],

    // Só as pastas de imagem do próprio projeto podem ser otimizadas.
    // Qualquer outro caminho responde 400 — evita que a rota de otimização
    // vire um redimensionador aberto para terceiros.
    localPatterns: [
      { pathname: "/images/**", search: "" },
      { pathname: "/veiculos/**", search: "" },
    ],
  },
  serverExternalPackages: [
    "sharp",
    "@imgly/background-removal-node",
    "onnxruntime-node",
  ],
};

export default nextConfig;
