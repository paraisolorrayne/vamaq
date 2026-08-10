import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiRole } from "@/lib/auth/api";
import {
  getOportunidade,
  updateOportunidade,
  setEtapa,
  deleteOportunidade,
} from "@/lib/crm/oportunidades";
import { acoesDaEtapa } from "@/lib/crm/etapas";
import { setVehicleStatus } from "@/lib/vehicleStore";
import { ligarVeiculo } from "@/lib/clientes/repo";

export async function GET(_request, { params }) {
  const auth = await requireApiRole(["vendedor", "secretaria"]);
  if (auth.error) return auth.error;
  const { id } = await params;
  const o = await getOportunidade(id);
  if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(o);
}

export async function PUT(request, { params }) {
  const auth = await requireApiRole(["vendedor", "secretaria"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const body = await request.json();
    if (!body.cliente_nome || !body.cliente_nome.trim()) {
      return NextResponse.json({ error: "Nome do cliente é obrigatório" }, { status: 400 });
    }
    const o = await updateOportunidade(id, body);
    if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(o);
  } catch (err) {
    return NextResponse.json({ error: `Erro ao salvar: ${err.message}` }, { status: 500 });
  }
}

// PATCH: mudar etapa, ou registrar a venda (marca o veículo como vendido).
export async function PATCH(request, { params }) {
  const auth = await requireApiRole(["vendedor", "secretaria"]);
  if (auth.error) return auth.error;
  const { id } = await params;
  const body = await request.json();

  if (body.action === "registrar-venda") {
    // A mesma regra de src/lib/crm/etapas.js (acoesDaEtapa), a única fonte —
    // ver Task 2. Sem checar aqui, uma oportunidade fora de "ganho" (ex.:
    // perdida, alcançada por um link salvo/histórico) confirmaria a venda e
    // tiraria o carro do site.
    const atual = await getOportunidade(id);
    if (!atual) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!acoesDaEtapa(atual).podeVender) {
      return NextResponse.json(
        { error: "Esta oportunidade não pode ter a venda registrada agora." },
        { status: 400 }
      );
    }
    const o = await setEtapa(id, "ganho");
    if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (o.vehicle_id) {
      await setVehicleStatus(o.vehicle_id, "vendido"); // sai do site, preserva histórico
      revalidatePath("/");
      revalidatePath("/acervo");
    }
    if (o.cliente_id && o.vehicle_id) {
      // O vínculo é um efeito colateral desejável, não a razão de existir da
      // venda: falhar aqui não pode desfazer uma venda já registrada. Mesma
      // forma de src/lib/documentos.js e src/lib/fiscal/notas.js.
      // Sem documentoId: venda pelo CRM não gera documentos_gerados.
      try {
        await ligarVeiculo({
          clienteId: o.cliente_id,
          vehicleId: o.vehicle_id,
          papel: "comprou",
          origem: "crm",
        });
      } catch (err) {
        console.error("Venda registrada, mas o vínculo cliente-veículo falhou:", err);
      }
    }
    return NextResponse.json(o);
  }

  if (typeof body.etapa === "string") {
    const o = await setEtapa(id, body.etapa, body.motivo_perda);
    if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(o);
  }
  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}

export async function DELETE(_request, { params }) {
  const auth = await requireApiRole(["vendedor", "secretaria"]);
  if (auth.error) return auth.error;
  const { id } = await params;
  const ok = await deleteOportunidade(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
