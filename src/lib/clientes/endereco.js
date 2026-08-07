/**
 * Endereço do cliente em uma linha só — é assim que o contrato pede.
 *
 * Puro de propósito (sem imports): o teste roda em `node --test`, onde "@/"
 * não resolve. O cadastro guarda o endereço em partes porque a NF-e exige
 * campo a campo; o contrato recebe a linha montada a partir delas.
 */

function limpo(valor) {
  return String(valor ?? "").trim();
}

// O CEP é gravado só com dígitos (a NF-e exige assim), mas essa linha vai
// impressa num contrato — documento jurídico. Com os 8 dígitos certos, sai
// mascarado (00000-000); com qualquer outra coisa (CEP incompleto, já
// digitado com máscara, etc.), imprime como veio em vez de inventar máscara
// para dado incompleto.
function formataCep(valor) {
  const c = limpo(valor);
  return /^\d{8}$/.test(c) ? `${c.slice(0, 5)}-${c.slice(5)}` : c;
}

export function enderecoEmUmaLinha(cliente) {
  if (!cliente) return "";
  const c = cliente;
  const cidadeUf = [limpo(c.municipio), limpo(c.uf)].filter(Boolean).join("/");
  const cep = formataCep(c.cep);
  return [
    limpo(c.logradouro),
    limpo(c.numero),
    limpo(c.complemento),
    limpo(c.bairro),
    cidadeUf,
    cep ? `CEP ${cep}` : "",
  ]
    .filter(Boolean)
    .join(", ");
}
