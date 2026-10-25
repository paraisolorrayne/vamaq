import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import VehicleDetailView from "@/components/VehicleDetailView";
import MovimentoFlag from "@/components/cinematica/MovimentoFlag";
import { getVehicleBySlug, getRelatedVehicles } from "@/lib/repositories/vehicles";
import { formatarKm, formatarPreco } from "@/lib/home/cinematica";
import { anoVeiculo } from "@/lib/anoVeiculo";

// Apresentação do carro = a ficha de sempre, com a galeria andando com a
// rolagem (VehicleDetailView com `naApresentacao`). Em 24/10/2026 passou por
// duas versões descartadas: todas as fotos em tela cheia (cansativo, o X6
// tem 20) e uma abertura animada antes da ficha (o pedido era o contrário:
// topo como hoje, animação nas fotos). Dinâmica como a ficha.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle) return {};
  return {
    title: `Apresentação — ${vehicle.brand} ${vehicle.model} ${anoVeiculo(vehicle)}`,
    // A maioria dos carros está sem descrição no cadastro; sem esta linha a
    // página saía sem meta description nenhuma.
    description:
      vehicle.description ||
      `${vehicle.brand} ${vehicle.model} ${anoVeiculo(vehicle)}, ${formatarKm(vehicle)}, ${formatarPreco(vehicle)} — na Vamaq Motors.`,
    // Mesma ficha: quem deve aparecer na busca é a ficha.
    alternates: { canonical: `/veiculo/${vehicle.slug}` },
  };
}

export default async function ApresentacaoPage({ params }) {
  const { slug } = await params;
  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle) notFound();

  const related = await getRelatedVehicles(vehicle, 3);

  return (
    <>
      <MovimentoFlag />
      <Header />
      <VehicleDetailView vehicle={vehicle} related={related} naApresentacao />
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
