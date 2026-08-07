import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { listClientes, createCliente } from "@/lib/clientes/repo";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireApiRole(["secretaria", "financeiro", "vendedor"]);
  if (auth.error) return auth.error;

  const params = new URL(request.url).searchParams;
  const busca = params.get("busca") || "";
  const incluirInativos = params.get("incluirInativos") === "true";

  try {
    const clientes = await listClientes({ busca, incluirInativos });
    return NextResponse.json({ clientes });
  } catch (err) {
    console.error("Falha ao listar clientes:", err);
    return NextResponse.json({ error: "Falha ao listar os clientes" }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireApiRole(["secretaria", "financeiro"]);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const res = await createCliente(body);
    if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ cliente: res.cliente });
  } catch (err) {
    console.error("Falha ao criar cliente:", err);
    return NextResponse.json({ error: "Falha ao criar o cliente" }, { status: 500 });
  }
}
