import { requireRole } from "@/lib/auth/dal";
import { listNotas, focusEnabled, listConsignacoesAbertas } from "@/lib/fiscal/notas";
import { veiculosSemEntrada } from "@/lib/fiscal/entradaPendente";
import { readVehicles } from "@/lib/vehicleStore";
import FiscalClient from "./FiscalClient";

export const metadata = {
  title: "Notas Fiscais — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function FiscalPage() {
  await requireRole(["financeiro", "secretaria"]);
  const notas = await listNotas();
  // Carros em consignação que nem venderam nem voltaram — os devolvíveis.
  const consignacoes = await listConsignacoesAbertas();
  const veiculos = await readVehicles();
  // A nota de saída nasce da venda: só veículo vendido pode ser emitido.
  const vendidos = veiculos.filter((v) => v.status === "vendido");

  // A de ENTRADA é o contrário: nasce da COMPRA, e é ela que destrava a venda
  // (o texto da nota de saída cita o número da entrada). Sai da lista o carro
  // que já tem entrada viva NO CICLO CORRENTE — um mesmo veículo tem uma
  // entrada por ciclo, porque o carro que volta na troca é uma nova aquisição.
  // Casar só por vehicle_id escondia esse carro do seletor para sempre, e o
  // seletor é o único caminho da tela para /admin/fiscal/entrada/[id].
  const semEntrada = veiculosSemEntrada(veiculos, notas);

  return (
    <FiscalClient
      notas={notas}
      ativo={focusEnabled()}
      vendidos={vendidos}
      semEntrada={semEntrada}
      consignacoes={consignacoes}
    />
  );
}
