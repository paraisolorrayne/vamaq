import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { getCliente, ligarVeiculo, desligarVeiculo } from "@/lib/clientes/repo";

export const dynamic = "force-dynamic";

// Mesmo formato usado em ARQUIVO_VALIDO (src/lib/documentos.js): um `id` de
// cliente que nem bate com a forma de um UUID nunca vai achar linha no
// banco. Sem essa checagem, o Postgres rejeita o tipo antes da query rodar e
// isso vira 500 genérico — tratamos como "não encontrado" (404), igual a um
// UUID válido porém inexistente.
const UUID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A tela nunca escolhe a origem: todo vínculo criado por aqui é "manual". Se
// deixássemos o corpo da requisição informar a origem, um vínculo manual
// poderia se disfarçar de vínculo nascido de contrato/nota.
export async function POST(request, { params }) {
  const auth = await requireApiRole(["secretaria", "financeiro"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!UUID_VALIDO.test(id)) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const vehicleId = String(body.vehicleId || "").trim();
    if (!vehicleId) {
      return NextResponse.json({ error: "Veículo é obrigatório." }, { status: 400 });
    }

    const res = await ligarVeiculo({
      clienteId: id,
      vehicleId,
      papel: body.papel,
      data: body.data,
      origem: "manual",
      documentoId: null,
      obs: body.obs,
    });
    if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ vinculo: res.vinculo });
  } catch (err) {
    // vehicleId pode ser um UUID válido que não existe mais em `vehicles`
    // (carro removido do estoque enquanto a ficha estava aberta) — a FK
    // estoura no banco. Isso é escolha inválida do operador, não falha de
    // servidor: 400 com mensagem, igual ao resto deste arquivo.
    if (err.code === "23503") {
      return NextResponse.json(
        { error: "Veículo não encontrado — ele pode ter sido removido do estoque." },
        { status: 400 }
      );
    }
    console.error("Falha ao vincular veículo ao cliente:", err);
    return NextResponse.json({ error: "Falha ao vincular o veículo ao cliente" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireApiRole(["secretaria", "financeiro"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!UUID_VALIDO.test(id)) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  try {
    const vinculoId = new URL(request.url).searchParams.get("vinculoId") || "";
    if (!vinculoId) {
      return NextResponse.json({ error: "vinculoId é obrigatório." }, { status: 400 });
    }

    // Confere que o vínculo pertence ao cliente da rota antes de apagar —
    // sem isso, qualquer id de vínculo seria apagável por qualquer rota de
    // cliente, mesmo um vínculo de outro cliente.
    const cliente = await getCliente(id);
    if (!cliente) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }
    const pertence = cliente.veiculos.some((v) => v.vinculo_id === vinculoId);
    if (!pertence) {
      return NextResponse.json({ error: "Vínculo não encontrado para este cliente." }, { status: 404 });
    }

    await desligarVeiculo(vinculoId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Falha ao desvincular veículo do cliente:", err);
    return NextResponse.json({ error: "Falha ao desvincular o veículo do cliente" }, { status: 500 });
  }
}
