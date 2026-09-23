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
    // custa CPU, as seguintes saem do cache. Depois de cadastrar carro ou de
    // mexer neste bloco, `node scripts/aquecer-fotos.mjs` paga esse custo no
    // lugar do visitante.

    // Só WebP. O AVIF saiu em 21/09/2026, medido ao vivo na VPS: a mesma foto,
    // fria, em w=2048, levou 6,2 s em AVIF contra 2,4 s em WebP — para
    // economizar 12% (180 kB x 205 kB). E isso sozinha: uma página de veículo
    // dispara dezenas de tamanhos de uma vez, e com a CPU disputada uma única
    // foto chegou a 20,7 s. O original já é WebP q90 (ver a rota de upload),
    // então o ganho do AVIF aqui é pequeno e o custo cai no primeiro visitante
    // de cada carro recém-cadastrado — justo quem a loja acabou de chamar.
    formats: ["image/webp"],

    // O padrão é 4 horas: vencido o prazo, a próxima visita recodifica a foto
    // (X-Nextjs-Cache: STALE), para sempre, e essa CPU disputa com as fotos
    // novas. Foto de veículo tem uuid no nome — o conteúdo daquele endereço
    // nunca muda. 31 dias, e não 1 ano, por causa de /images/** fora de
    // vehicles/: ali um arquivo pode ser trocado mantendo o nome, e o Next não
    // tem como invalidar (só apagando .next/cache/images).
    minimumCacheTTL: 2678400,

    // O padrão vai até 3840. O upload limita o original a 2560 px, então 3840
    // só gera mais uma variante fria para recodificar o mesmo 2560.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],

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
