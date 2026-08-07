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

export function enderecoEmUmaLinha(cliente) {
  if (!cliente) return "";
  const c = cliente;
  const cidadeUf = [limpo(c.municipio), limpo(c.uf)].filter(Boolean).join("/");
  const cep = limpo(c.cep);
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
