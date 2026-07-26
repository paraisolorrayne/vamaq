import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  getVehicleById,
  updateVehicle,
  deleteVehicle,
} from "@/lib/vehicleStore";
import { requireApiRole } from "@/lib/auth/api";

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
    return NextResponse.json(
      { error: `Erro ao salvar veículo: ${err.message}` },
      { status: 500 }
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
