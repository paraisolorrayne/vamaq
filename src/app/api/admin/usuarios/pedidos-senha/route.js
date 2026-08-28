import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireApiRole } from "@/lib/auth/api";

/**
 * Quantas pessoas pediram senha nova na tela de login e ainda esperam.
 *
 * Existe para o aviso do Dashboard: sem ele, o pedido só aparece em
 * /admin/usuarios, uma tela que o admin abre uma vez por mês — e a pessoa
 * fica do lado de fora esperando alguém abrir uma tela por acaso. Mesmo
 * motivo do aviso de contas a aprovar.
 *
 * Só admin: quem pode redefinir a senha é quem precisa do aviso.
 */
export async function GET() {
  const auth = await requireApiRole("admin");
  if (auth.error) return auth.error;

  const { rows } = await query(
    `select count(*)::int as pedidos
       from users
      where reset_requested_at is not null and active = true`
  );
  return NextResponse.json({ pedidos: rows[0].pedidos });
}
