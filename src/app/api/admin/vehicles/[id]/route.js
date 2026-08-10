import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  getVehicleById,
  updateVehicle,
  deleteVehicle,
  setVehicleStatus,
} from "@/lib/vehicleStore";
import { requireApiRole } from "@/lib/auth/api";
import { ligarVeiculo } from "@/lib/clientes/repo";

export async function GET(_request, { params }) {
  const auth = await requireApiRole();
  if (auth.error) return auth.error;

  const { id } = await params;
  const vehicle = await getVehicleById(id);
  if (!vehicle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(vehicle);
}

export async function PUT(request, { params }) {
  const auth = await requireApiRole();
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const updated = await updateVehicle(id, body);
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    revalidatePath('/');
    revalidatePath('/acervo');
    if (updated.slug) revalidatePath(`/veiculo/${updated.slug}`);

    return NextResponse.json(updated);
  } catch (err) {
    console.error('Vehicle update error:', err);
    if (err.constraint === 'ano_modelo_check') {
      return NextResponse.json(
        { error: 'O ano do modelo não pode ser anterior ao de fabricação (nem passar de 2036).' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: `Erro ao salvar veículo: ${err.message}` },
      { status: 500 }
    );
  }
}

// Muda só o status do veículo (ciclo de vida). Usado pelo "Desativar"/
// "Reativar" da lista de estoque (no lugar da exclusão) e por
// /admin/estoque/[id]/vender para marcar como vendido.
//
// Tira carro do site — por isso exige um dos papéis que já veem o Estoque,
// não só "estar logado" (frouxidão corrigida junto da entrega de marcar
// vendido: ver docs/superpowers/specs/2026-08-10-marcar-vendido-design.md).
// Não tira acesso de ninguém que use a tela: são exatamente os quatro papéis
// de src/app/admin/estoque/page.js.
export async function PATCH(request, { params }) {
  const auth = await requireApiRole(["estoque", "financeiro", "vendedor", "secretaria"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const { status, clienteId } = await request.json();
    const updated = await setVehicleStatus(id, status);
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    revalidatePath('/');
    revalidatePath('/acervo');
    if (updated.slug) revalidatePath(`/veiculo/${updated.slug}`);

    // Venda de balcão marcada pelo Estoque, com cliente escolhido: mesmo
    // vínculo que o CRM cria ao registrar a venda (ver
    // src/app/api/admin/crm/oportunidades/[id]/route.js, ramo
    // "registrar-venda") — papel "comprou", origem "estoque" para
    // diferenciar de onde a venda nasceu. Efeito colateral desejável, não o
    // motivo de existir da venda: uma venda já marcada não pode virar erro
    // porque o vínculo falhou, daí o try/catch que só registra o log.
    if (status === "vendido" && clienteId) {
      try {
        await ligarVeiculo({
          clienteId,
          vehicleId: id,
          papel: "comprou",
          origem: "estoque",
        });
      } catch (err) {
        console.error("Veículo marcado como vendido, mas o vínculo cliente-veículo falhou:", err);
      }
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('Vehicle status error:', err);
    return NextResponse.json(
      { error: `Erro ao mudar status: ${err.message}` },
      { status: 400 }
    );
  }
}

export async function DELETE(_request, { params }) {
  const auth = await requireApiRole();
  if (auth.error) return auth.error;

  const { id } = await params;
  const ok = await deleteVehicle(id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  revalidatePath('/');
  revalidatePath('/acervo');

  return NextResponse.json({ success: true });
}
