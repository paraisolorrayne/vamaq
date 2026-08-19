/**
 * Grafia única da marca do veículo.
 *
 * O PROBLEMA (visto em 19/08/2026 numa captura do acervo): a lista de filtros
 * mostrava `AUDI`, `Audi` e `Audi ` como três marcas diferentes, e `BMW` duas
 * vezes. Eram 17 entradas de filtro para 13 marcas reais. O cadastro gravava
 * `body.brand` cru — sem aparar espaço e sem uniformizar a caixa —, então cada
 * pessoa que digitava criava uma variante nova.
 *
 * A CORREÇÃO NÃO É "TUDO MAIÚSCULO": nome de marca tem grafia própria. Forçar
 * caixa alta daria `MERCEDES-BENZ`; forçar capitalização daria `Bmw`. As duas
 * ficam erradas. Por isso a lista canônica abaixo, com a grafia que a própria
 * montadora usa.
 *
 * Marca fora da lista é aceita como foi digitada (só aparada): o pátio recebe
 * carro de marca que ninguém previu, e recusar ou deturpar o que a pessoa
 * escreveu seria pior que uma variante a mais.
 *
 * Puro de propósito: sem banco e sem rede, para rodar em `node --test`.
 */

// A grafia que cada montadora usa. Comparação é por minúsculas sem espaço,
// então `bmw`, `BMW ` e `Bmw` caem todos aqui.
const CANONICAS = [
  "Audi",
  "BMW",
  "BYD",
  "Chevrolet",
  "Chery",
  "Dodge",
  "Citroën",
  "Fiat",
  "Ford",
  "GWM",
  "Honda",
  "Hyundai",
  "Jaguar",
  "Jeep",
  "Kia",
  "Land Rover",
  "Mercedes-Benz",
  "Mitsubishi",
  "Nissan",
  "Peugeot",
  "Porsche",
  "RAM",
  "Renault",
  "Suzuki",
  "Toyota",
  "Volkswagen",
  "Volvo",
];

/**
 * Como as pessoas escrevem × a grafia oficial.
 *
 * Só entra aqui o que é a MESMA marca escrita de outro jeito — apelido de uso
 * corrente ("Mercedes") ou erro de digitação já visto no cadastro ("Cherry"
 * por "Chery"). Nada de adivinhar: `BMW X1` não vira `BMW`, porque ali o
 * modelo foi digitado no campo da marca e alguém precisa olhar o cadastro
 * para saber o que fazer com o resto.
 */
const APELIDOS = {
  mercedes: "Mercedes-Benz",
  mercedesbenz: "Mercedes-Benz",
  cherry: "Chery",
  vw: "Volkswagen",
  gm: "Chevrolet",
  chevy: "Chevrolet",
  landrover: "Land Rover",
};

const POR_CHAVE = new Map([
  ...CANONICAS.map((m) => [chave(m), m]),
  ...Object.entries(APELIDOS),
]);

/** Chave de comparação: minúsculas, sem espaços e sem hífen. */
function chave(valor) {
  return String(valor ?? "")
    .toLowerCase()
    .replace(/[\s-]+/g, "");
}

/**
 * A marca como deve ser gravada.
 *
 * Sempre apara as pontas e reduz espaço repetido do meio — é o que criava
 * `Audi` e `Audi ` como coisas distintas. Depois disso, se a marca for
 * conhecida, devolve a grafia oficial.
 */
export function normalizaMarca(valor) {
  const limpo = String(valor ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!limpo) return "";
  return POR_CHAVE.get(chave(limpo)) || limpo;
}

/** As marcas conhecidas, para quem quiser oferecer sugestão na tela. */
export function marcasConhecidas() {
  return [...CANONICAS];
}
