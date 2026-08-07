import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { getCliente } from "@/lib/clientes/repo";
import FichaClient from "./FichaClient";

export const metadata = {
  title: "Ficha do cliente — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function FichaClientePage({ params }) {
  // O layout do /admin já barra por papel; aqui é defesa em profundidade,
  // igual à tela de lista (ClientesClient).
  await requireRole(["secretaria", "financeiro"]);
  const { id } = await params;
  const cliente = await getCliente(id);
  if (!cliente) notFound();
  return <FichaClient cliente={cliente} />;
}
