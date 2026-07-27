import { redirect } from "next/navigation";

// O guia de documentos virou o tutorial de Documentos dentro da Central de
// Tutoriais (/admin/tutoriais). Mantém o URL antigo funcionando.
export default function GuiaDocumentosRedirect() {
  redirect("/admin/tutoriais/documentos");
}
