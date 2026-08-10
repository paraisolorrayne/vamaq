/**
 * O que o CRM copia de um cliente cadastrado, e como saber que falta vincular.
 *
 * Puro de propósito (sem I/O e sem imports): usado na tela e no teste, que roda
 * em `node --test`, onde o alias "@/" não resolve.
 */

/** Campos que o seletor copia do cadastro para a oportunidade. */
export function dadosDoCliente(cliente) {
  const c = cliente || {};
  return {
    cliente_id: c.id || null,
    cliente_nome: String(c.nome ?? "").trim(),
    telefone: String(c.telefone ?? "").trim(),
    email: String(c.email ?? "").trim(),
  };
}

/** Oportunidade que ainda não aponta para um cliente do cadastro. */
export function precisaVincular(oportunidade) {
  return !oportunidade?.cliente_id;
}
