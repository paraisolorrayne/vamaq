import { requireRole } from "@/lib/auth/dal";
import { listUsers } from "@/lib/auth/users";
import { ROLES } from "@/lib/auth/permissions";
import { listFuncionarios } from "@/lib/rh/funcionarios";
import UsuariosClient from "./UsuariosClient";

export const metadata = {
  title: "Usuários — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function UsuariosPage() {
  // Só admin (o layout já barra; aqui é defesa em profundidade).
  const me = await requireRole("admin");
  const users = await listUsers();
  const funcionarios = await listFuncionarios();
  return <UsuariosClient users={users} roles={ROLES} meId={me.id} funcionarios={funcionarios} />;
}
