import { requireRole } from "@/lib/auth/dal";
import { canAccessPath } from "@/lib/auth/permissions";
import EstoqueClient from "./EstoqueClient";

export const metadata = {
  title: "Estoque — Vamaq Motors",
};

// Server Component só para saber QUEM está olhando: o botão "Emitir nota" leva
// a /admin/fiscal/emitir, que é de financeiro e secretaria. Mostrá-lo para
// estoque ou vendedor daria um botão que expulsa a pessoa da tela — foi o que
// aconteceu com o CRM da secretaria por meses, e não se repete aqui.
// A guarda abaixo é defesa em profundidade: o layout do /admin já barra por
// prefixo, mas a página não deve depender só dele.
export default async function EstoquePage() {
  const user = await requireRole(["estoque", "financeiro", "vendedor", "secretaria"]);
  const podeEmitirNota = canAccessPath(user.role, "/admin/fiscal");

  return <EstoqueClient podeEmitirNota={podeEmitirNota} />;
}
