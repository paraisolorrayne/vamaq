/**
 * Data Access Layer de autorização (ADR-002 §5.5).
 *
 * A checagem de verdade mora aqui, junto do dado — o proxy (src/proxy.js) só
 * faz a checagem otimista de presença de cookie, e a própria doc do Next diz
 * que ele não é linha de defesa. Toda página server e Server Action do /admin
 * chama requireUser()/requireRole(); os Route Handlers usam src/lib/auth/api.js.
 *
 * verifySession() é memoizado com cache() do React: uma consulta ao banco por
 * render, mesmo chamado em vários pontos da árvore.
 */
import { cache } from "react";
import { redirect } from "next/navigation";
import { readSessionUser } from "@/lib/auth/session";

/** Usuário da sessão (ou null). Memoizado por render. */
export const verifySession = cache(async () => {
  return readSessionUser();
});

/** Exige sessão válida; senão manda pro login. Retorna o usuário. */
export async function requireUser() {
  const user = await verifySession();
  if (!user) redirect("/login");
  return user;
}

/**
 * Exige que o usuário tenha um dos papéis. admin passa em tudo.
 * Sem sessão → login; papel insuficiente → /admin (sem acesso).
 */
export async function requireRole(roles) {
  const allow = Array.isArray(roles) ? roles : [roles];
  const user = await requireUser();
  if (user.role !== "admin" && !allow.includes(user.role)) {
    redirect("/admin");
  }
  return user;
}
