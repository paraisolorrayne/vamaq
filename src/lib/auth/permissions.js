/**
 * Permissões por papel (quem vê/acessa o quê no /admin).
 *
 * `admin` acessa tudo. Os demais papéis acessam só as seções listadas. Usado
 * tanto para filtrar o menu (AdminNav) quanto para barrar acesso direto por URL
 * (o layout do /admin redireciona quem entra numa seção fora do seu papel).
 *
 * Sem dependências pesadas — seguro para o bundle do proxy, se preciso.
 */

// Papéis conhecidos e um rótulo amigável (para a tela de usuários).
export const ROLES = {
  admin: "Administrador (tudo)",
  estoque: "Estoque (só cadastro de veículos)",
  financeiro: "Financeiro",
  vendedor: "Vendedor",
  secretaria: "Secretária administrativa",
};

// Cada seção do /admin: prefixo de rota + papéis com acesso (além de admin).
// Ordem importa: do mais específico para o mais genérico (/admin por último).
const SECTIONS = [
  { key: "usuarios", prefix: "/admin/usuarios", label: "Usuários", icon: "👥", roles: [] },
  { key: "documentos", prefix: "/admin/documentos", label: "Documentos", icon: "📄", roles: ["vendedor", "secretaria"] },
  { key: "criativos", prefix: "/admin/criativos", label: "Gerar Criativos", icon: "🎨", roles: ["estoque", "vendedor", "secretaria"] },
  { key: "fipe", prefix: "/admin/fipe", label: "Tabela FIPE", icon: "💰", roles: ["estoque", "financeiro", "secretaria"] },
  { key: "estoque", prefix: "/admin/estoque", label: "Estoque", icon: "🚗", roles: ["estoque", "financeiro", "vendedor", "secretaria"] },
  { key: "crm", prefix: "/admin/crm", label: "CRM (Vendas)", icon: "🤝", roles: ["vendedor", "secretaria"] },
  { key: "financeiro", prefix: "/admin/financeiro", label: "Financeiro", icon: "📊", roles: ["financeiro"] },
  { key: "tutoriais", prefix: "/admin/tutoriais", label: "Tutoriais", icon: "📚", roles: ["estoque", "financeiro", "vendedor", "secretaria"] },
  { key: "dashboard", prefix: "/admin", label: "Dashboard", icon: "📈", roles: ["estoque", "financeiro", "vendedor", "secretaria"] },
];

function sectionForPath(pathname) {
  return SECTIONS.find((s) => pathname === s.prefix || pathname.startsWith(s.prefix + "/")) || null;
}

/** O papel pode abrir esta rota do /admin? admin sempre pode. */
export function canAccessPath(role, pathname) {
  if (role === "admin") return true;
  const section = sectionForPath(pathname);
  if (!section) return true; // rota admin não mapeada: não bloqueia
  return section.roles.includes(role);
}

/** Itens de menu que este papel deve ver, na ordem de exibição. */
export function navFor(role) {
  const order = ["dashboard", "estoque", "crm", "financeiro", "documentos", "criativos", "fipe", "tutoriais", "usuarios"];
  const HIDDEN = new Set();
  return order
    .filter((key) => !HIDDEN.has(key))
    .map((key) => SECTIONS.find((s) => s.key === key))
    .filter(Boolean)
    .filter((s) => role === "admin" || s.roles.includes(role))
    .map((s) => ({ href: s.prefix, label: s.label, icon: s.icon }));
}
