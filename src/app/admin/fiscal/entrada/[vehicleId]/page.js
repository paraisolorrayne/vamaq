import { requireRole } from "@/lib/auth/dal";
import { getDadosEmissao, focusEnabled } from "@/lib/fiscal/notas";
import { query } from "@/lib/db";
import EntradaClient from "./EntradaClient";

export const metadata = {
  title: "Nota de entrada — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function EntradaPage({ params }) {
  await requireRole(["financeiro", "secretaria"]);
  const { vehicleId } = await params;

  const dados = await getDadosEmissao(vehicleId);
  if (!dados) {
    return <p style={{ padding: 24 }}>Veículo não encontrado.</p>;
  }

  // Uma entrada por veículo. A saída não entra nesta conta: o carro tem as
  // duas, e é justamente a entrada que destrava a venda.
  const { rows } = await query(
    `select ref, status from notas_fiscais
      where vehicle_id=$1 and operacao='entrada' and status in ('processando','autorizada')
      limit 1`,
    [vehicleId]
  );

  return (
    <EntradaClient
      veiculo={dados.veiculo}
      ativo={focusEnabled()}
      notaExistente={rows[0] || null}
    />
  );
}
