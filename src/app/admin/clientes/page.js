import { requireRole } from "@/lib/auth/dal";
import ClientesClient from "./ClientesClient";

export const metadata = {
  title: "Clientes — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function ClientesPage() {
  // O layout do /admin já barra por papel; aqui é defesa em profundidade.
  await requireRole(["secretaria", "financeiro"]);
  return <ClientesClient />;
}
