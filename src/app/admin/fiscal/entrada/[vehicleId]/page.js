import { requireRole } from "@/lib/auth/dal";
import { getDadosEmissao, focusEnabled, dadosParaRefazer, notaEntradaAtiva } from "@/lib/fiscal/notas";
import EntradaClient from "./EntradaClient";

export const metadata = {
  title: "Nota de entrada — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function EntradaPage({ params, searchParams }) {
  await requireRole(["financeiro", "secretaria"]);
  const { vehicleId } = await params;
  const { refazer } = (await searchParams) || {};

  const dados = await getDadosEmissao(vehicleId);
  if (!dados) {
    return <p style={{ padding: 24 }}>Veículo não encontrado.</p>;
  }

  // Uma entrada por CICLO, não por veículo — o carro que voltou na troca tem
  // uma entrada nova, do ciclo novo. A saída não entra nesta conta: o carro
  // tem as duas, e é justamente a entrada que destrava a venda.
  //
  // Esta tela é a própria trava: ela decide sozinha se mostra o formulário ou
  // o aviso "já tem nota de entrada". Por isso usa a MESMA função que a
  // guarda de emissão (notaEntradaAtiva, em notas.js) — não uma cópia da
  // consulta: foi exatamente uma cópia desatualizada aqui que deixou a tela
  // bloqueando a entrada do ciclo novo com a nota do ciclo velho.
  const notaExistente = await notaEntradaAtiva(vehicleId, dados.veiculo.ciclo);

  // Reemissão depois de um cancelamento: os dados vêm da nota antiga, para
  // não redigitar oito campos de endereço e errar de um jeito novo.
  const anterior = refazer ? await dadosParaRefazer(String(refazer)) : null;

  return (
    <EntradaClient
      veiculo={dados.veiculo}
      anterior={anterior && anterior.vehicleId === vehicleId ? anterior : null}
      ativo={focusEnabled()}
      notaExistente={notaExistente}
    />
  );
}
