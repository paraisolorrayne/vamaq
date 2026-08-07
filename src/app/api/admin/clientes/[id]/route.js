import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { getCliente, updateCliente, setClienteAtivo } from "@/lib/clientes/repo";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const auth = await requireApiRole(["secretaria", "financeiro", "vendedor"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const cliente = await getCliente(id);
    if (!cliente) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ cliente });
  } catch (err) {
    console.error("Falha ao buscar cliente:", err);
    return NextResponse.json({ error: "Falha ao buscar o cliente" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const auth = await requireApiRole(["secretaria", "financeiro"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const res = await updateCliente(id, body);
    if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ cliente: res.cliente });
  } catch (err) {
    console.error("Falha ao atualizar cliente:", err);
    return NextResponse.json({ error: "Falha ao atualizar o cliente" }, { status: 500 });
  }
}

// Não apaga o registro: cliente com contrato ou nota fiscal é histórico, e
// apagar de verdade derrubaria o vínculo com o veículo por cascade. Em vez
// disso, só marca como inativo (some das listas, mas continua na base).
export async function DELETE(_request, { params }) {
  const auth = await requireApiRole(["secretaria", "financeiro"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    await setClienteAtivo(id, false);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Falha ao desativar cliente:", err);
    return NextResponse.json({ error: "Falha ao desativar o cliente" }, { status: 500 });
  }
}
