import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { getContact, updateContact, deleteContact } from "@/lib/fin/repositories/finance";

export async function GET(_request, { params }) {
  const auth = await requireApiRole(["financeiro"]);
  if (auth.error) return auth.error;
  const { id } = await params;
  const c = await getContact(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(c);
}

export async function PUT(request, { params }) {
  const auth = await requireApiRole(["financeiro"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const body = await request.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }
    const c = await updateContact(id, body);
    if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(c);
  } catch (err) {
    console.error("Contato update error:", err);
    return NextResponse.json({ error: `Erro ao salvar: ${err.message}` }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  const auth = await requireApiRole(["financeiro"]);
  if (auth.error) return auth.error;
  const { id } = await params;
  const res = await deleteContact(id);
  if (!res.ok) return NextResponse.json({ error: res.error || "Não encontrado" }, { status: 400 });
  return NextResponse.json({ success: true });
}
