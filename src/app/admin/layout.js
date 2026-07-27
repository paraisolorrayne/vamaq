import { redirect } from "next/navigation";
import AdminNav from "./AdminNav";
import { requireUser } from "@/lib/auth/dal";
import styles from "./admin.module.css";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }) {
  // Gate server-side: sem sessão válida, requireUser() redireciona pro /login.
  // O proxy já barra na borda por cookie; aqui é a checagem de verdade (§5.5).
  const user = await requireUser();

  // Primeiro acesso (senha inicial): obriga a trocar antes de usar o admin.
  if (user.must_change_password) redirect("/trocar-senha");

  return (
    <div className={styles.layout}>
      <AdminNav user={user} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
