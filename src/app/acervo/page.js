/**
 * /acervo — Server Component.
 *
 * Busca a lista completa de veículos publicados + opções de filtro no
 * servidor (via repository) e passa tudo como props para o componente
 * cliente interativo (`AcervoClient`), que cuida de filtragem, ordenação
 * e paginação client-side.
 */

import {
  getAllVehicles,
  getBrands,
  getBodyTypes,
  getFuelTypes,
} from "@/lib/repositories/vehicles";
import AcervoClient from "./AcervoClient";

// Render dinâmico: a lista lê o estoque direto do Postgres (não via fetch),
// então o Next não consegue auto-invalidar o cache quando o admin cria/edita
// um veículo. Forçar dinâmico garante que cada acesso reflita o banco na hora.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nosso Acervo — Vamaq Motors",
  description:
    "Veículos premium, esportivos e superesportivos selecionados pela Vamaq Motors. Curadoria rigorosa, procedência garantida.",
};

export default async function AcervoPage() {
  const [initialVehicles, brands, bodyTypes, fuelTypes] = await Promise.all([
    getAllVehicles(),
    getBrands(),
    getBodyTypes(),
    getFuelTypes(),
  ]);

  return (
    <AcervoClient
      initialVehicles={initialVehicles}
      brands={brands}
      bodyTypes={bodyTypes}
      fuelTypes={fuelTypes}
    />
  );
}
