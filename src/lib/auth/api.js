/**
 * Guarda de autorização para Route Handlers (/api/admin/*).
 *
 * Uso no início do handler:
 *
 *   const auth = await requireApiRole();          // qualquer usuário logado
 *   if (auth.error) return auth.error;            // 401/403 pronto
 *   // auth.user disponível
 *
 * Ou exigindo papel:  requireApiRole(["financeiro"])
 *
 * Retorna Response (não redirect) porque API não redireciona — devolve status.
 */
import { NextResponse } from "next/server";
import { readSessionUser } from "@/lib/auth/session";

export async function requireApiRole(roles = null) {
  const user = await readSessionUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }),
    };
  }
  if (roles) {
    const allow = Array.isArray(roles) ? roles : [roles];
    if (user.role !== "admin" && !allow.includes(user.role)) {
      return {
        error: NextResponse.json({ error: "Sem permissão" }, { status: 403 }),
      };
    }
  }
  return { user };
}
