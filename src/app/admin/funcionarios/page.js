import { requireRole } from "@/lib/auth/dal";
import { listFuncionarios } from "@/lib/rh/funcionarios";
import FuncionariosClient from "./FuncionariosClient";

export const metadata = {
  title: "Funcionários — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function FuncionariosPage() {
  // Só admin (o layout já barra; aqui é defesa em profundidade).
  await requireRole("admin");
  const funcionarios = await listFuncionarios();
  return <FuncionariosClient funcionarios={funcionarios} />;
}
