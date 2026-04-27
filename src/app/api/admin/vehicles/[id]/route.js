import { NextResponse } from "next/server";
import {
  getVehicleById,
  updateVehicle,
  deleteVehicle,
} from "@/lib/vehicleStore";

export async function GET(_request, { params }) {
  const { id } = await params;
  const vehicle = getVehicleById(id);
  if (!vehicle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(vehicle);
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const body = await request.json();
  const updated = updateVehicle(id, body);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_request, { params }) {
  const { id } = await params;
  const ok = deleteVehicle(id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
