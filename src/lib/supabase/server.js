/**
 * Server Supabase client — para uso em Server Components, Server Actions e
 * Route Handlers. Lê/escreve cookies da requisição para manter a sessão
 * do usuário autenticado (admin logado).
 *
 * NUNCA use a service role key aqui — isso é para `admin.js`.
 */
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Sem credenciais → retorna null para fallback em mock mode.
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components não podem setar cookies — ignorado; o middleware
          // cuida disso em rotas autenticadas.
        }
      },
    },
  });
}
