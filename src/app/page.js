import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import MovimentoFlag from "@/components/cinematica/MovimentoFlag";
import CinematicaMotion from "@/components/cinematica/CinematicaMotion";
import CenaReveal from "@/components/cinematica/CenaReveal";
import CenaVitrine from "@/components/cinematica/CenaVitrine";
import CenaBoutique from "@/components/cinematica/CenaBoutique";
import { getFeaturedVehicles, getAllVehicles } from "@/lib/repositories/vehicles";
import { escolherCenas } from "@/lib/home/cinematica";

// Home cinematográfica (25/10/2026): o destaque revelado pela cortina, a
// vitrine em camadas e a loja. Cada cena é HTML do servidor que já funciona
// parado; o movimento é do CinematicaMotion (components/cinematica).
// Render dinâmico: as cenas leem o estoque direto do Postgres, então o cache
// estático não enxergaria as alterações feitas no admin. Ver /acervo.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Vamaq Motors — Curadoria de carros especiais",
  description:
    "Showroom de veículos premium, esportivos e modelos especiais com curadoria, procedência e atendimento especializado.",
};

export default async function HomePage() {
  const [destaques, estoque] = await Promise.all([
    getFeaturedVehicles(4),
    getAllVehicles(),
  ]);
  // Nenhum carro aparece em duas cenas — ver src/lib/home/cinematica.js.
  const { hero, vitrine } = escolherCenas(destaques, estoque);

  return (
    <>
      <MovimentoFlag />
      <Header />
      <main id="main-content">
        <CenaReveal vehicle={hero} />
        <CenaVitrine veiculos={vitrine} totalEstoque={estoque.length} />
        <CenaBoutique />
        <CinematicaMotion />
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
