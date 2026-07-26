import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";
import LoginForm from "./LoginForm";
import styles from "./login.module.css";

export const metadata = {
  title: "Entrar — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }) {
  // Já logado? vai direto pro admin.
  const user = await verifySession();
  if (user) redirect("/admin");

  const sp = await searchParams;
  const next = typeof sp?.next === "string" ? sp.next : "/admin";

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Painel Vamaq</h1>
        <p className={styles.subtitle}>Acesso restrito à equipe.</p>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
