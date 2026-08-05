import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { getVehicleMargins } from "@/lib/fin/repositories/finance";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireApiRole(["financeiro", "secretaria"]);
  if (auth.error) return auth.error;
  const all = new URL(request.url).searchParams.get("all") === "true";
  return NextResponse.json(await getVehicleMargins({ onlyWithActivity: !all }));
}
