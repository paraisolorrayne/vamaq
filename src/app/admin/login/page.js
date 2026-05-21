import LogoVamaq from '@/components/LogoVamaq';
import LoginForm from './LoginForm';
import styles from './login.module.css';

export const metadata = {
  title: 'Login Admin — Vamaq Motors',
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }) {
  const sp = await searchParams;
  const next = typeof sp?.next === 'string' ? sp.next : '/admin/veiculos';

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <LogoVamaq />
        </div>
        <h1 className={styles.title}>Área Administrativa</h1>
        <p className={styles.subtitle}>
          Acesso restrito à equipe Vamaq Motors.
        </p>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
