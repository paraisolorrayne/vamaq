import { NextResponse } from "next/server";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

// Formata datas ISO (YYYY-MM-DD, vindas de <input type="date">) por extenso,
// ex.: "23 de junho de 2026". Faz o parse manual para evitar deslocamento de
// fuso horário.
function formatValue(value) {
  if (typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const dia = parseInt(m[3], 10);
      const mes = MESES[parseInt(m[2], 10) - 1] || m[2];
      return `${dia} de ${mes} de ${m[1]}`;
    }
  }
  return value;
}

export async function POST(request) {
  try {
    const { templateBody, values, title } = await request.json();

    if (!templateBody || !values) {
      return NextResponse.json(
        { error: "templateBody and values are required" },
        { status: 400 }
      );
    }

    let filled = templateBody;
    for (const [key, value] of Object.entries(values)) {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const formatted = formatValue(value);
      filled = filled.replace(new RegExp(`\\{\\{${escaped}\\}\\}`, "g"), () => formatted || "_______________");
    }

    return NextResponse.json({
      title: title || "Documento",
      content: filled,
    });
  } catch (err) {
    console.error("Document generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate document", details: err.message },
      { status: 500 }
    );
  }
}
