import fs from "fs/promises";
import path from "path";

/**
 * Entrega a foto de veículo que o Next não conhece.
 *
 * O `next start` lista `public/` UMA vez, na subida do processo. Foto enviada
 * pelo painel depois disso (src/app/api/admin/upload/route.js) não existe para
 * o Next até o próximo restart. Para o visitante isso não aparecia: o nginx
 * entrega `/images/vehicles/*` direto do disco. Mas o otimizador
 * (`/_next/image`) busca a foto por DENTRO do Next, recebia a página 404 em
 * HTML e respondia 400 "isn't a valid image" — todo carro cadastrado depois do
 * último restart ficava sem foto no site (21/09/2026).
 *
 * O Next consulta a lista de `public/` antes das rotas, então esta rota só é
 * alcançada pelo arquivo que ficou de fora da lista. Depois de um restart a
 * foto volta a sair como arquivo estático e isto aqui nem é chamado.
 */
const RAIZ = path.join(process.cwd(), "public", "images", "vehicles");

// Exatamente o nome que o upload gera: uuid + .webp. Sem isto,
// "../../.env.local" viraria um caminho válido.
const NOME_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { arquivo } = await params;
  if (!NOME_VALIDO.test(String(arquivo))) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const conteudo = await fs.readFile(path.join(RAIZ, arquivo));
    return new Response(conteudo, {
      headers: {
        "Content-Type": "image/webp",
        // O nome é um uuid: o conteúdo daquele endereço nunca muda.
        "Cache-Control": "public, max-age=2592000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
