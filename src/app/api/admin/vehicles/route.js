import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { readVehicles, addVehicle } from "@/lib/vehicleStore";

export async function GET() {
  const vehicles = await readVehicles();
  return NextResponse.json(vehicles);
}

export async function POST(request) {
  const body = await request.json();
  const vehicle = await addVehicle(body);

  revalidatePath('/');
  revalidatePath('/acervo');

  return NextResponse.json(vehicle, { status: 201 });
}
