import { requireUser } from "@/lib/auth/dal";
import ChangePasswordForm from "./ChangePasswordForm";
import styles from "@/app/login/login.module.css";

export const metadata = {
  title: "Trocar senha — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function ChangePasswordPage() {
  // exige sessão (redireciona pro /login se não houver); permite must_change.
  const user = await requireUser();

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Trocar senha</h1>
        <p className={styles.subtitle}>
          {user.must_change_password
            ? "Primeiro acesso: defina uma nova senha para continuar."
            : "Defina uma nova senha."}
        </p>
        <ChangePasswordForm />
      </div>
    </main>
  );
}
