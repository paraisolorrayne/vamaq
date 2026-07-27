"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoVamaq from "@/components/LogoVamaq";
import { logoutAction } from "@/app/login/actions";
import styles from "./admin.module.css";

// Itens padrão (fallback). O menu real vem filtrado por papel via prop `nav`.
const DEFAULT_NAV = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/estoque", label: "Estoque", icon: "🚗" },
  { href: "/admin/documentos", label: "Documentos", icon: "📄" },
  { href: "/admin/criativos", label: "Gerar Criativos", icon: "🎨" },
  { href: "/admin/fipe", label: "Tabela FIPE", icon: "💰" },
  { href: "/admin/tutoriais", label: "Tutoriais", icon: "📚" },
];

export default function AdminNav({ user, nav }) {
  const pathname = usePathname();
  const NAV_ITEMS = nav && nav.length ? nav : DEFAULT_NAV;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <Link href="/admin" className={styles.logoLink}>
          <LogoVamaq variant="dark" className={styles.logoImage} />
        </Link>
        <span className={styles.logoSub}>Painel Administrativo</span>
      </div>
      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className={styles.sidebarFooter}>
        {user ? (
          <div className={styles.userBox}>
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userRole}>{user.role}</span>
          </div>
        ) : null}
        <form action={logoutAction}>
          <button type="submit" className={styles.logoutBtn}>
            Sair
          </button>
        </form>
        <Link href="/" className={styles.backLink}>
          ← Voltar ao Site
        </Link>
      </div>
    </aside>
  );
}
