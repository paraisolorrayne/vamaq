/**
 * Proxy (antigo "middleware" — renomeado no Next 16) do /admin.
 *
 * Só checagem OTIMISTA: existe o cookie de sessão? Não valida no banco (proxy
 * não deve fazer I/O de sessão — ADR-002 §5.5 e doc do Next). A validação real
 * é o DAL (src/lib/auth/dal.js) nas páginas/actions e src/lib/auth/api.js nas
 * rotas. Aqui só evita renderizar a área logada pra quem nem cookie tem.
 *
 * - /admin/*      sem cookie → redireciona pro /login (com ?next=)
 * - /api/admin/*  sem cookie → 401 (API não redireciona)
 *
 * O /login fica FORA do matcher (não pode exigir auth — seria galinha e ovo).
 */
import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth/constants";

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const hasCookie = Boolean(request.cookies.get(COOKIE_NAME)?.value);
  if (hasCookie) return NextResponse.next();

  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
