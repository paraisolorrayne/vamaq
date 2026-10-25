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

// Prova de conceito da home cinematográfica (24/10/2026). Fica ao lado da
// home atual para comparar com o mesmo estoque; fora do Google até virar a
// home de verdade. Dinâmica pelo mesmo motivo da home: lê o estoque do banco.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Prévia — Vamaq Motors",
  description:
    "Showroom de veículos premium, esportivos e modelos especiais com curadoria, procedência e atendimento especializado.",
  robots: { index: false, follow: false },
};

// ?abertura=luz mostra a primeira versão da cena 1 (facho de luz), para
// comparar com a cortina, que é a padrão.
export default async function PreviaPage({ searchParams }) {
  const { abertura } = await searchParams;
  const [destaques, estoque] = await Promise.all([
    getFeaturedVehicles(4),
    getAllVehicles(),
  ]);
  const { hero, vitrine } = escolherCenas(destaques, estoque);

  return (
    <>
      <MovimentoFlag />
      {/* Fundo branco, como o resto do site (24/10/2026): header normal. */}
      <Header />
      <main id="main-content">
        <CenaReveal vehicle={hero} efeito={abertura === "luz" ? "luz" : "cortina"} />
        <CenaVitrine veiculos={vitrine} totalEstoque={estoque.length} />
        <CenaBoutique />
        <CinematicaMotion />
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
