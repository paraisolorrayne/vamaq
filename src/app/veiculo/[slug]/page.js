import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import VehicleDetailView from "@/components/VehicleDetailView";
import {
  getVehicleBySlug,
  getRelatedVehicles,
} from "@/lib/repositories/vehicles";

// Render dinâmico: a página lê o veículo direto do Postgres. Com ISR estático
// as edições do admin não refletiam e slugs novos não eram pré-gerados.
// Dinâmico garante que cada acesso busque o estado atual do banco.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle) return {};
  return {
    title: `${vehicle.brand} ${vehicle.model} ${vehicle.year}`,
    description: vehicle.description,
    openGraph: {
      title: `${vehicle.brand} ${vehicle.model} ${vehicle.year} — Vamaq Motors`,
      description: vehicle.description,
    },
  };
}

export default async function VeiculoPage({ params }) {
  const { slug } = await params;
  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle) notFound();

  const related = await getRelatedVehicles(vehicle, 3);

  return (
    <>
      <Header />
      <VehicleDetailView vehicle={vehicle} related={related} />
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
