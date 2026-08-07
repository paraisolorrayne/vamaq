import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { getDadosEmissao, focusEnabled } from "@/lib/fiscal/notas";
import { listClientes } from "@/lib/clientes/repo";
import EmitirClient from "./EmitirClient";

export const metadata = {
  title: "Emitir nota fiscal — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function EmitirPage({ params }) {
  await requireRole(["admin", "financeiro"]);
  const { vehicleId } = await params;
  const dados = await getDadosEmissao(vehicleId);
  if (!dados) notFound();
  const clientes = await listClientes({});
  return <EmitirClient {...dados} clientes={clientes} ativo={focusEnabled()} vehicleId={vehicleId} />;
}
