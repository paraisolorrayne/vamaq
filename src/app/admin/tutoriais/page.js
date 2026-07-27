import Link from "next/link";
import styles from "../admin.module.css";
import t from "./tutorial.module.css";

export const metadata = {
  title: "Tutoriais — Vamaq Motors",
};

// Cada funcionalidade da Vamaq tem seu tutorial aqui. `soon: true` mostra o
// card como "em breve" (sem link) — usado para módulos ainda não lançados.
const TUTORIAIS = [
  {
    href: "/admin/tutoriais/estoque",
    icon: "🚗",
    title: "Estoque",
    desc: "Cadastrar, editar e publicar veículos, com fotos e consulta FIPE.",
  },
  {
    href: "/admin/tutoriais/documentos",
    icon: "📄",
    title: "Documentos",
    desc: "Gerar contratos de compra, venda, consignação e vistoria sem erro.",
  },
  {
    href: "/admin/tutoriais/criativos",
    icon: "🎨",
    title: "Gerar Criativos",
    desc: "Montar as artes de anúncio de um veículo para redes e vitrine.",
  },
  {
    href: "/admin/tutoriais/fipe",
    icon: "💰",
    title: "Tabela FIPE",
    desc: "Consultar o preço de referência de carros, motos e caminhões.",
  },
  {
    href: "/admin/tutoriais/financeiro",
    icon: "📊",
    title: "Financeiro",
    desc: "Lançamentos, DRE, margem por veículo, cobranças e contas a pagar.",
  },
];

export default function TutoriaisPage() {
  return (
    <div className={t.wrap}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Tutoriais</h1>
        <p className={styles.pageSubtitle}>
          Passo a passo de cada funcionalidade do painel da Vamaq
        </p>
      </div>

      <div className={t.cardGrid}>
        {TUTORIAIS.map((item) =>
          item.soon ? (
            <div key={item.title} className={`${t.card} ${t.cardSoon}`}>
              <div className={t.cardIcon}>{item.icon}</div>
              <div className={t.cardTitle}>{item.title}</div>
              <p className={t.cardDesc}>{item.desc}</p>
              <span className={t.soonBadge}>Em breve</span>
            </div>
          ) : (
            <Link key={item.title} href={item.href} className={t.card}>
              <div className={t.cardIcon}>{item.icon}</div>
              <div className={t.cardTitle}>{item.title}</div>
              <p className={t.cardDesc}>{item.desc}</p>
            </Link>
          )
        )}
      </div>
    </div>
  );
}
