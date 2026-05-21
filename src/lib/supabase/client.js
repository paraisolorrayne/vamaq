/**
 * Browser Supabase client — para uso em Client Components.
 * Usa a ANON key (seguro expor; RLS protege os dados).
 */
import { createBrowserClient } from '@supabase/ssr';

let cached = null;

export function getBrowserSupabase() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Sem credenciais → retorna null; o repository usa fallback para mock data.
    return null;
  }

  cached = createBrowserClient(url, anonKey);
  return cached;
}
