import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { getReferencias } from "@/lib/fin/repositories/finance";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiRole(["financeiro"]);
  if (auth.error) return auth.error;
  return NextResponse.json(await getReferencias());
}
