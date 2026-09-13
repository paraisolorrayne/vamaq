/**
 * /acervo — Server Component.
 *
 * Busca a lista completa de veículos publicados e entrega ao componente
 * cliente, que filtra, ordena e pagina no navegador.
 *
 * UMA leitura da tabela, não quatro. Esta página pedia getAllVehicles(),
 * getBrands(), getBodyTypes() E getFuelTypes() num Promise.all — e cada uma
 * das três últimas chamava getAllVehicles() por dentro. Eram quatro varreduras
 * completas por carregamento para montar três listas de opções que saem da
 * mesma lista. Agora as opções são derivadas no cliente, de graça, a partir
 * dos veículos que já vieram.
 */

import { getAllVehicles } from "@/lib/repositories/vehicles";
import AcervoClient from "./AcervoClient";

// Render dinâmico: a lista lê o estoque direto do Postgres (não via fetch),
// então o Next não consegue auto-invalidar o cache quando o admin cria/edita
// um veículo. Forçar dinâmico garante que cada acesso reflita o banco na hora.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Showroom — Vamaq Motors",
  description:
    "Showroom de veículos premium, esportivos e superesportivos selecionados pela Vamaq Motors. Curadoria rigorosa, procedência garantida.",
};

export default async function AcervoPage() {
  const veiculos = await getAllVehicles();

  return <AcervoClient veiculos={veiculos} />;
}
