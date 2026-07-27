import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { createContact } from "@/lib/fin/repositories/finance";

export async function POST(request) {
  const auth = await requireApiRole(["financeiro"]);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();
    if (!body.name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    const contact = await createContact(body);
    return NextResponse.json(contact, { status: 201 });
  } catch (err) {
    console.error("Contato create error:", err);
    return NextResponse.json({ error: `Erro ao salvar contato: ${err.message}` }, { status: 500 });
  }
}
