import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { getDRE } from "@/lib/fin/repositories/finance";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireApiRole(["financeiro", "secretaria"]);
  if (auth.error) return auth.error;
  const sp = new URL(request.url).searchParams;
  const dre = await getDRE({ from: sp.get("from") || undefined, to: sp.get("to") || undefined });
  return NextResponse.json(dre);
}
