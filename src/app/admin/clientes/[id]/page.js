import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { getCliente } from "@/lib/clientes/repo";
import FichaClient from "./FichaClient";

export const metadata = {
  title: "Ficha do cliente — Vamaq Motors",
  robots: { index: false, follow: false },
};

// Mesma guarda de src/app/api/admin/clientes/[id]/route.js: um `id` que nem
// bate com a forma de um UUID nunca vai achar linha no banco, e sem essa
// checagem o Postgres rejeita o tipo antes da query rodar — isso sobe como
// exceção não tratada e vira a tela de erro genérica do Next em vez do
// notFound() que esta página já pretende usar.
const UUID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FichaClientePage({ params }) {
  // O layout do /admin já barra por papel; aqui é defesa em profundidade,
  // igual à tela de lista (ClientesClient).
  await requireRole(["secretaria", "financeiro"]);
  const { id } = await params;
  if (!UUID_VALIDO.test(id)) notFound();
  const cliente = await getCliente(id);
  if (!cliente) notFound();
  return <FichaClient cliente={cliente} />;
}
