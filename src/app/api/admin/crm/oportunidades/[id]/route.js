import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiRole } from "@/lib/auth/api";
import {
  getOportunidade,
  updateOportunidade,
  setEtapa,
  deleteOportunidade,
} from "@/lib/crm/oportunidades";
import { setVehicleStatus } from "@/lib/vehicleStore";

export async function GET(_request, { params }) {
  const auth = await requireApiRole(["vendedor"]);
  if (auth.error) return auth.error;
  const { id } = await params;
  const o = await getOportunidade(id);
  if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(o);
}

export async function PUT(request, { params }) {
  const auth = await requireApiRole(["vendedor"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const body = await request.json();
    const o = await updateOportunidade(id, body);
    if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(o);
  } catch (err) {
    return NextResponse.json({ error: `Erro ao salvar: ${err.message}` }, { status: 500 });
  }
}

// PATCH: mudar etapa, ou registrar a venda (marca o veículo como vendido).
export async function PATCH(request, { params }) {
  const auth = await requireApiRole(["vendedor"]);
  if (auth.error) return auth.error;
  const { id } = await params;
  const body = await request.json();

  if (body.action === "registrar-venda") {
    const o = await setEtapa(id, "ganho");
    if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (o.vehicle_id) {
      await setVehicleStatus(o.vehicle_id, "vendido"); // sai do site, preserva histórico
      revalidatePath("/");
      revalidatePath("/acervo");
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
  const auth = await requireApiRole(["vendedor"]);
  if (auth.error) return auth.error;
  const { id } = await params;
  const ok = await deleteOportunidade(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
