import { requireRole } from "@/lib/auth/dal";
import { listNotas, focusEnabled } from "@/lib/fiscal/notas";
import { readVehicles } from "@/lib/vehicleStore";
import FiscalClient from "./FiscalClient";

export const metadata = {
  title: "Notas Fiscais — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function FiscalPage() {
  await requireRole(["financeiro", "secretaria"]);
  const notas = await listNotas();
  // A nota nasce da venda: só veículo vendido pode ser emitido.
  const vendidos = (await readVehicles()).filter((v) => v.status === "vendido");
  return <FiscalClient notas={notas} ativo={focusEnabled()} vendidos={vendidos} />;
}
