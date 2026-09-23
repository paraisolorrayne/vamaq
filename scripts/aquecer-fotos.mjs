/**
 * Aquece o cache do otimizador de imagem, para o visitante não pagar a conta.
 *
 * A primeira requisição de cada foto em cada tamanho custa CPU na VPS (~2 s em
 * WebP, sozinha). Uma página de veículo pede dezenas de tamanhos de uma vez;
 * em 21/09/2026, com as fotos do dia todas frias, uma única foto levou 20,7 s.
 * Este script faz essas primeiras requisições ele mesmo — UMA POR VEZ, de
 * propósito: o que causou os 20 s foi justamente a disputa de CPU.
 *
 * Rodar depois de cadastrar carro, de deploy que mexa no bloco `images` do
 * next.config.mjs, ou de apagar .next/cache/images:
 *
 *   node scripts/aquecer-fotos.mjs                 # site no ar, até 1920 px
 *   node scripts/aquecer-fotos.mjs --tudo          # todos os tamanhos do srcset
 *   node scripts/aquecer-fotos.mjs http://localhost:3000
 *
 * Só faz GET em página pública. O que já está quente responde HIT em
 * milissegundos, então rodar de novo é barato.
 */
const args = process.argv.slice(2);
const TUDO = args.includes("--tudo");
const BASE = (args.find((a) => a.startsWith("http")) || "https://vamaqmotors.com.br").replace(/\/$/, "");
const LARGURA_MAX = 1920;

async function html(caminho) {
  const res = await fetch(BASE + caminho);
  if (!res.ok) throw new Error(`${caminho} respondeu ${res.status}`);
  return res.text();
}

function imagens(pagina) {
  const achadas = pagina.match(/\/_next\/image\?url=[^"'\s,]+/g) || [];
  return achadas.map((u) => u.replaceAll("&amp;", "&"));
}

const acervo = await html("/acervo");
const paginas = ["/", "/acervo", ...new Set(acervo.match(/\/veiculo\/[a-z0-9-]+/g) || [])];

const urls = new Set();
for (const p of paginas) {
  for (const u of imagens(p === "/acervo" ? acervo : await html(p))) {
    const w = Number(new URLSearchParams(u.split("?")[1]).get("w"));
    if (TUDO || w <= LARGURA_MAX) urls.add(u);
  }
}
console.log(`${paginas.length} páginas, ${urls.size} imagens a conferir em ${BASE}`);

const conta = { HIT: 0, MISS: 0, STALE: 0, erro: 0 };
let n = 0;
for (const u of urls) {
  n += 1;
  const inicio = Date.now();
  try {
    // O mesmo Accept de um navegador: o formato faz parte da chave do cache.
    const res = await fetch(BASE + u, { headers: { Accept: "image/avif,image/webp,*/*" } });
    await res.arrayBuffer();
    const estado = res.ok ? res.headers.get("x-nextjs-cache") || "?" : "erro";
    conta[estado] = (conta[estado] || 0) + 1;
    if (estado !== "HIT") {
      console.log(`[${n}/${urls.size}] ${estado} ${res.status} ${((Date.now() - inicio) / 1000).toFixed(1)}s ${decodeURIComponent(u).slice(16, 90)}`);
    }
  } catch (err) {
    conta.erro += 1;
    console.log(`[${n}/${urls.size}] falhou: ${err.message}`);
  }
}

console.log(conta);
// Erro aqui é foto que o visitante também não vê — ex.: o 400 "isn't a valid
// image" de 21/09. Sai com código 1 para servir de smoke check de deploy.
process.exit(conta.erro ? 1 : 0);
