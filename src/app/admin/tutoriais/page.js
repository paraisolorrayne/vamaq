import Link from "next/link";
import styles from "../admin.module.css";
import t from "./tutorial.module.css";
import { requireRole } from "@/lib/auth/dal";
import EnviarGravacao from "./EnviarGravacao";

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
    href: "/admin/tutoriais/crm",
    icon: "🤝",
    title: "CRM",
    desc: "Acompanhar oportunidades de venda do primeiro contato até o fechamento.",
  },
  {
    href: "/admin/tutoriais/clientes",
    icon: "🧑",
    title: "Clientes",
    desc: "Cadastrar clientes e reaproveitar os dados em contratos e notas fiscais.",
  },
  {
    href: "/admin/tutoriais/documentos",
    icon: "📄",
    title: "Documentos",
    desc: "Gerar contratos de compra, venda, consignação e vistoria sem erro.",
  },
  {
    href: "/admin/tutoriais/fiscal",
    icon: "🧾",
    title: "Notas Fiscais",
    desc: "Emitir e acompanhar a NF-e de cada veículo vendido.",
  },
  {
    href: "/admin/tutoriais/financeiro",
    icon: "📊",
    title: "Financeiro",
    desc: "Lançamentos, DRE, margem por veículo, cobranças e contas a pagar.",
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
    href: "/admin/tutoriais/funcionarios",
    icon: "🧑‍🔧",
    title: "Funcionários",
    desc: "Ficha, admissão, saída e acesso ao sistema de cada funcionário.",
  },
];

// As gravações que os tutoriais exibem. Cada slug casa com um
// <Demonstracao slug="..."> dentro do tutorial correspondente.
const GRAVACOES = [
  { slug: "conta-a-pagar", titulo: "Financeiro · cadastrar conta lendo o boleto" },
  { slug: "criar-categoria", titulo: "Financeiro · criar uma categoria nova" },
  { slug: "emitir-nota", titulo: "Notas Fiscais · emitir a nota de venda" },
  { slug: "marcar-vendido", titulo: "Estoque · marcar um carro como vendido" },
];

export default async function TutoriaisPage() {
  const user = await requireRole();
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

      {user.role === "admin" && <EnviarGravacao slugs={GRAVACOES} />}
    </div>
  );
}
