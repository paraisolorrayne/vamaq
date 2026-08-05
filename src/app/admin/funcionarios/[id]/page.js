import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { getFuncionario } from "@/lib/rh/funcionarios";
import { ROLES } from "@/lib/auth/permissions";
import { listUsers } from "@/lib/auth/users";
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
  // Logins que ainda não pertencem a nenhuma ficha — são os candidatos a vínculo.
  const usuariosLivres = (await listUsers()).filter((u) => !u.funcionario_id);
  return <FichaClient funcionario={funcionario} roles={ROLES} usuariosLivres={usuariosLivres} />;
}
