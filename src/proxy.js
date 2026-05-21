/**
 * Proxy do Next 16 (antigo middleware). Roda antes de cada request.
 *
 * Responsabilidades:
 *  - Renova o cookie de sessão Supabase em toda navegação (necessário para
 *    Server Components autenticados).
 *  - Bloqueia /admin/* para usuário não logado (redireciona ao login).
 *  - Se o usuário já está logado e acessa /admin/login, manda pro dashboard.
 */
import { NextResponse } from 'next/server';
import { updateSupabaseSession } from '@/lib/supabase/proxy';

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const { response, user } = await updateSupabaseSession(request);

  const isAdminArea = pathname.startsWith('/admin');
  const isLoginPage = pathname === '/admin/login';

  if (isAdminArea && !isLoginPage && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (isLoginPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/veiculos';
    url.searchParams.delete('next');
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Aplica em tudo, exceto assets do Next e arquivos estáticos
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
