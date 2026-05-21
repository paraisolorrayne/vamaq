import Link from 'next/link';
import { redirect } from 'next/navigation';
import LogoVamaq from '@/components/LogoVamaq';
import { getServerSupabase } from '@/lib/supabase/server';
import { signOutAction } from '../login/actions';
import styles from '../admin.module.css';

export const metadata = {
  title: 'Admin — Vamaq Motors',
  robots: { index: false, follow: false },
};

async function getCurrentProfile() {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .maybeSingle();
  return data || { id: user.id, email: user.email, role: 'editor' };
}

export default async function AdminLayout({ children }) {
  // O proxy já garante autenticação. Aqui carregamos o perfil pra exibir
  // no header e disponibilizar nas server actions via cookies.
  const profile = await getCurrentProfile();

  // /admin/login não passa pelo gate porque tem seu próprio layout root.
  // Mas se cair aqui sem profile, manda voltar.
  if (!profile) {
    redirect('/admin/login');
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/admin/veiculos" className={styles.brand} aria-label="Vamaq Admin">
          <LogoVamaq className={styles.brandLogo} />
          <span className={styles.brandTag}>ADMIN</span>
        </Link>

        <nav className={styles.nav} aria-label="Navegação admin">
          <Link href="/admin/veiculos" className={styles.navLink}>Veículos</Link>
          <Link href="/" className={styles.navLink} target="_blank" rel="noopener">
            Ver site público ↗
          </Link>
        </nav>

        <div className={styles.userBox}>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{profile.full_name || profile.email}</span>
            <span className={styles.userRole}>{profile.role}</span>
          </div>
          <form action={signOutAction}>
            <button type="submit" className={styles.signOut}>Sair</button>
          </form>
        </div>
      </header>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
