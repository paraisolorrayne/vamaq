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

  return (
    <div className={styles.layout}>
      <AdminNav user={user} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
