/**
 * Admin Supabase client — ignora RLS usando a service role key.
 *
 * ⚠️  APENAS PARA CÓDIGO SERVER-SIDE QUE PRECISA DE ACESSO TOTAL:
 *     - Jobs de processamento de imagem
 *     - Operações administrativas em massa
 *     - Criação inicial de usuário admin
 *
 * NUNCA importe este módulo em Client Components. Nunca exponha a chave.
 */
import { createClient } from '@supabase/supabase-js';

let cached = null;

export function getAdminSupabase() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return null;
  }

  cached = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cached;
}
