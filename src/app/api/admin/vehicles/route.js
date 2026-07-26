import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { readVehicles, addVehicle } from "@/lib/vehicleStore";
import { requireApiRole } from "@/lib/auth/api";

export async function GET() {
  const auth = await requireApiRole();
  if (auth.error) return auth.error;

  const vehicles = await readVehicles();
  return NextResponse.json(vehicles);
}

export async function POST(request) {
  const auth = await requireApiRole();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const vehicle = await addVehicle(body);

    revalidatePath('/');
    revalidatePath('/acervo');

    return NextResponse.json(vehicle, { status: 201 });
  } catch (err) {
    console.error('Vehicle create error:', err);
    return NextResponse.json(
      { error: `Erro ao salvar veículo: ${err.message}` },
      { status: 500 }
    );
  }
}
