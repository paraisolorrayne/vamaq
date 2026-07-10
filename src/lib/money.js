// Parsing e formatação de valores em reais (pt-BR) — fonte única, usada pelo
// formulário de estoque e pelos modelos de contrato.

// Converte entrada humana em número: "299.000", "299.000,00", "R$ 158.000,00",
// "158000", "158000.5" → número. NaN se não der para interpretar.
//
// Regras: com vírgula, pontos são separador de milhar ("299.000,00" → 299000).
// Sem vírgula, pontos só são milhar quando seguem o padrão 1.234.567
// ("299.000" → 299000); caso contrário valem como decimal ("1.5" → 1.5).
export function parseValorBR(raw) {
  let s = String(raw ?? "")
    .trim()
    .replace(/[R$\s]/g, "");
  if (!s) return NaN;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  return parseFloat(s);
}

// Número → "299.000" / "158.000,50" (sem símbolo, para inputs e criativos).
export function formatValorBR(n) {
  const num = Number(n);
  if (!isFinite(num)) return "";
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
