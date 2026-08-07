/**
 * CPF/CNPJ do cliente: normalização, tipo e máscara.
 *
 * Puro de propósito (sem I/O e sem imports): é usado na tela, na API e no
 * teste, que roda em `node --test`, onde o alias "@/" não resolve.
 *
 * O documento é gravado SÓ COM DÍGITOS. Sem isso, "123.456.789-00" e
 * "12345678900" viram dois cadastros da mesma pessoa.
 */

export function normalizaDoc(valor) {
  return String(valor ?? "").replace(/\D/g, "");
}

export function tipoPorDoc(valor) {
  const d = normalizaDoc(valor);
  if (d.length === 11) return "pf";
  if (d.length === 14) return "pj";
  return null;
}

export function docValido(valor) {
  return tipoPorDoc(valor) !== null;
}

export function formataDoc(valor) {
  const d = normalizaDoc(valor);
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return d;
}
