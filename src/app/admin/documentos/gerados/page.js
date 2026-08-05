import { requireRole } from "@/lib/auth/dal";
import { listDocumentos } from "@/lib/documentos";
import GeradosClient from "./GeradosClient";

export const metadata = {
  title: "Documentos gerados — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function GeradosPage() {
  await requireRole(["admin", "vendedor", "secretaria"]);
  const documentos = await listDocumentos();
  return <GeradosClient documentos={documentos} />;
}
