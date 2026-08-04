import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { getFuncionario } from "@/lib/rh/funcionarios";
import { ROLES } from "@/lib/auth/permissions";
import FichaClient from "./FichaClient";

export const metadata = {
  title: "Ficha do funcionário — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function FichaPage({ params }) {
  await requireRole("admin");
  const { id } = await params;
  const funcionario = await getFuncionario(id);
  if (!funcionario) notFound();
  return <FichaClient funcionario={funcionario} roles={ROLES} />;
}
