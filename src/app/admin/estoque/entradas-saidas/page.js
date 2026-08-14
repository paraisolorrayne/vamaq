import { requireRole } from "@/lib/auth/dal";
import { canAccessPath } from "@/lib/auth/permissions";
import { readVehicles } from "@/lib/vehicleStore";
import { getVehicleMargins } from "@/lib/fin/repositories/finance";
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

  const porVeiculo = new Map(margens.map((m) => [m.vehicle_id, m]));
  const linhas = veiculos.map((v) => {
    const m = porVeiculo.get(v.id);
    return {
      id: v.id,
      brand: v.brand,
      model: v.model,
      year: v.year,
      ano_modelo: v.ano_modelo,
      placa: v.placa,
      chassi: v.chassi,
      status: v.status,
      data_entrada: v.data_entrada ? String(v.data_entrada).slice(0, 10) : null,
      data_saida: v.data_saida ? String(v.data_saida).slice(0, 10) : null,
      // Zero NÃO é valor: getVehicleMargins devolve 0 para carro sem lançamento
      // nenhum, e "R$ 0,00" na coluna Compra se lê como "comprado de graça".
      // Ausência de lançamento tem que aparecer como ausência.
      compra: m && m.custo_aquisicao > 0 ? m.custo_aquisicao : null,
      venda: m && m.receita > 0 ? m.receita : null,
      resultado:
        m && (m.custo_aquisicao > 0 || m.receita > 0) ? m.resultado_liquido : null,
    };
  });

  return <EntradasSaidasClient linhas={linhas} podeVerValores={podeVerValores} />;
}
