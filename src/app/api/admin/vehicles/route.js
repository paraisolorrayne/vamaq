import { NextResponse } from "next/server";
import { readVehicles, addVehicle } from "@/lib/vehicleStore";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  const vehicles = readVehicles();
  return NextResponse.json(vehicles);
}

export async function POST(request) {
  const body = await request.json();

  const slug =
    `${body.brand}-${body.model}-${body.year}`
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "") + `-${Date.now()}`;

  const vehicle = {
    id: `vamaq-${uuidv4().slice(0, 8)}`,
    brand: body.brand || "",
    model: body.model || "",
    year: Number(body.year) || new Date().getFullYear(),
    price: body.price ? Number(body.price) : null,
    mileage: Number(body.mileage) || 0,
    fuel: body.fuel || "Gasolina",
    transmission: body.transmission || "Automático",
    power: body.power || "",
    color: body.color || "",
    bodyType: body.bodyType || "Sedan",
    featured: Boolean(body.featured),
    badge: body.badge || null,
    images: body.images || { main: "", gallery: [] },
    specs: body.specs || {
      engine: "",
      acceleration: "",
      topSpeed: "",
      doors: 4,
      seats: 5,
    },
    description: body.description || "",
    slug,
  };

  await addVehicle(vehicle);
  return NextResponse.json(vehicle, { status: 201 });
}
