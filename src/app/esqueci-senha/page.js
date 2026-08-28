import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";
import EsqueciSenhaForm from "./EsqueciSenhaForm";
import styles from "../login/login.module.css";

export const metadata = {
  title: "Esqueci minha senha — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function EsqueciSenhaPage() {
  // Quem já está logado não precisa desta tela — troca a senha em /trocar-senha.
  const user = await verifySession();
  if (user) redirect("/trocar-senha");

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Esqueci minha senha</h1>
        <p className={styles.subtitle}>
          Informe o e-mail que você usa para entrar no painel. A administração
          da loja gera uma senha provisória e envia para você.
        </p>
        <EsqueciSenhaForm />
      </div>
    </main>
  );
}
