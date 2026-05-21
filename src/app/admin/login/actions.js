'use server';

import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';

export async function signInAction(formData) {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const next = String(formData.get('next') || '/admin/veiculos');

  if (!email || !password) {
    return { error: 'Informe email e senha.' };
  }

  const supabase = await getServerSupabase();
  if (!supabase) {
    return { error: 'Supabase não está configurado. Verifique .env.local.' };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message || 'Falha ao autenticar.' };
  }

  redirect(next);
}

export async function signOutAction() {
  const supabase = await getServerSupabase();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect('/admin/login');
}
