import { requireRole } from "@/lib/auth/dal";
import { canAccessPath } from "@/lib/auth/permissions";
import { readVehicles, readCiclosEncerrados } from "@/lib/vehicleStore";
import { getVehicleMargins } from "@/lib/fin/repositories/finance";
import { linhasComCiclos } from "@/lib/estoque/ciclosDoVeiculo";
import EntradasSaidasClient from "./EntradasSaidasClient";

export const metadata = {
  title: "Entradas e saídas — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function EntradasSaidasPage() {
  const user = await requireRole(["estoque", "financeiro", "vendedor", "secretaria"]);

  // Os VALORES são financeiros e não pertencem a quem só cuida do pátio. As
  // datas, sim — o registro de entrada e saída é do estoque. Mesma regra que o
  // botão "Emitir nota" já usa para aparecer ou não.
  const podeVerValores = canAccessPath(user.role, "/admin/financeiro");

  const veiculos = await readVehicles();
  let margens = [];
  if (podeVerValores) {
    try {
      margens = await getVehicleMargins({ onlyWithActivity: false });
    } catch {
      // Financeiro fora do ar não pode derrubar o registro de entrada e saída:
      // a tela cai para só as datas, que é o que ela promete primeiro.
      margens = [];
    }
  }

  // Os ciclos encerrados: sem eles, a compra original do carro que voltou na
  // troca some do relatório que existe justamente para registrar entradas e
  // saídas do pátio.
  let ciclos = [];
  try {
    ciclos = await readCiclosEncerrados();
  } catch {
    // Mesma postura do financeiro acima: a tela cai para o ciclo corrente, que
    // é o que ela já mostrava antes de existir ciclo.
    ciclos = [];
  }

  const linhas = linhasComCiclos({ veiculos, ciclos, margens });

  return <EntradasSaidasClient linhas={linhas} podeVerValores={podeVerValores} />;
}
