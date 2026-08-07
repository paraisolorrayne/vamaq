/**
 * Normaliza texto de busca de veículo: minúsculas, só letras e números.
 *
 * Existe por causa da placa: ABC-1D23, abc 1d23 e ABC1D23 são a mesma placa, e
 * a pessoa digita do jeito que estiver acostumada. Descartar a pontuação dos
 * DOIS lados da comparação é o que faz o hífen deixar de quebrar a busca.
 *
 * Puro e sem imports de propósito — é o único ponto desta entrega onde um erro
 * passaria despercebido, então tem teste.
 */
export function normalizaBusca(texto) {
  return String(texto ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
