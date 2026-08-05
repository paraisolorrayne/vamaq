import { requireRole } from "@/lib/auth/dal";
import { listNotas, focusEnabled } from "@/lib/fiscal/notas";
import FiscalClient from "./FiscalClient";

export const metadata = {
  title: "Notas Fiscais — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function FiscalPage() {
  await requireRole(["admin", "financeiro"]);
  const notas = await listNotas();
  return <FiscalClient notas={notas} ativo={focusEnabled()} />;
}
