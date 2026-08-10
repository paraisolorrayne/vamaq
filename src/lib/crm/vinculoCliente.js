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

/**
 * Decide se o seletor pode oferecer "Cadastrar «termo» como cliente novo".
 *
 * Existe para fechar um buraco real (ver fix-duplicado-report.md, item 2):
 * no pátio, com 3G ruim, a busca pode falhar (fetch estourando) sem que a
 * tela saiba diferenciar "procurei e não achei" de "nunca consegui
 * procurar". Sem esta função, o segundo caso também oferecia cadastrar —
 * criando um duplicado do cliente que a busca nunca chegou a checar.
 *
 * Só pode oferecer quando: há termo digitado, a busca não está em
 * andamento, a busca não terminou em erro, e ela terminou sem resultado.
 * Qualquer um desses fora do lugar (sem termo, buscando, com erro, ou com
 * resultado) e a resposta é não.
 */
export function podeOferecerCadastro({ termo, buscando, erro, resultados }) {
  if (!String(termo ?? "").trim()) return false;
  if (buscando) return false;
  if (erro) return false;
  const lista = Array.isArray(resultados) ? resultados : [];
  return lista.length === 0;
}
