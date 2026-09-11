/**
 * Os filtros do acervo: quem entra na lista, em que ordem, e como isso cabe
 * numa URL.
 *
 * Puro de propósito — sem banco, sem rede, sem React. São 32 veículos hoje:
 * o servidor manda a lista e o filtro acontece no navegador, sem ida e volta
 * a cada clique. Se o acervo crescer uma ordem de grandeza, é aqui que a
 * decisão muda, e o teste continua valendo.
 *
 * PORQUE O ESTADO VIVE NA URL: o vendedor precisa mandar a busca pronta no
 * WhatsApp ("olha os Porsche de 2022 pra cima"), e quem entra no carro e volta
 * não pode perder o que filtrou. Query string resolve os dois de graça.
 */

import { normalizaBusca } from "../buscaVeiculo.js";

export const ORDENS = [
  { valor: "recentes", rotulo: "Mais recentes" },
  { valor: "precoAsc", rotulo: "Menor preço" },
  { valor: "precoDesc", rotulo: "Maior preço" },
  { valor: "anoDesc", rotulo: "Ano mais recente" },
  { valor: "kmAsc", rotulo: "Menor quilometragem" },
];

const ORDENS_VALIDAS = new Set(ORDENS.map((o) => o.valor));
const BLINDAGENS = new Set(["todos", "sim", "nao"]);

export const FILTROS_VAZIOS = Object.freeze({
  busca: "",
  marcas: [],
  modelos: [],
  carrocerias: [],
  combustiveis: [],
  cambios: [],
  precoMin: null,
  precoMax: null,
  anoMin: null,
  anoMax: null,
  kmMax: null,
  blindagem: "todos",
  ordem: "recentes",
});

/**
 * Faixas de preço prontas.
 *
 * FIXAS, e não derivadas do estoque: faixa calculada por quantil muda de
 * rótulo a cada carro que entra ou sai, e "R$ 287.400 a R$ 612.900" não é
 * uma pergunta que alguém se faz. Os valores viajam ABSOLUTOS na URL, então
 * um link compartilhado continua significando a mesma coisa mesmo depois de
 * mexermos nesta lista.
 */
export const FAIXAS_PRECO = [
  { rotulo: "até R$ 200 mil", min: null, max: 200000 },
  { rotulo: "R$ 200 a 300 mil", min: 200000, max: 300000 },
  { rotulo: "R$ 300 a 500 mil", min: 300000, max: 500000 },
  { rotulo: "R$ 500 mil a 1 milhão", min: 500000, max: 1000000 },
  { rotulo: "acima de R$ 1 milhão", min: 1000000, max: null },
];

export const FAIXAS_KM = [
  { rotulo: "até 10.000 km", max: 10000 },
  { rotulo: "até 30.000 km", max: 30000 },
  { rotulo: "até 50.000 km", max: 50000 },
  { rotulo: "até 100.000 km", max: 100000 },
];

/** Dobra acento e pontuação: "Citroën" e "citroen" passam a se encontrar. */
function comparavel(texto) {
  return normalizaBusca(
    String(texto ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
  );
}

function numeroOuNull(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function lista(valor) {
  return Array.isArray(valor) ? valor.filter(Boolean) : [];
}

/** Aplica todos os filtros. Nada de ordenação aqui — são perguntas separadas. */
export function filtraVeiculos(veiculos, filtros = FILTROS_VAZIOS) {
  const f = { ...FILTROS_VAZIOS, ...filtros };
  let fora = Array.isArray(veiculos) ? [...veiculos] : [];

  const porConjunto = (campo, selecionados) => {
    const sel = lista(selecionados);
    if (!sel.length) return;
    const set = new Set(sel);
    fora = fora.filter((v) => set.has(v[campo]));
  };

  porConjunto("brand", f.marcas);
  porConjunto("model", f.modelos);
  porConjunto("bodyType", f.carrocerias);
  porConjunto("fuel", f.combustiveis);
  porConjunto("transmission", f.cambios);

  // PREÇO: o carro "Sob consulta" (price null) aparece quando ninguém filtrou
  // por valor, e SAI quando alguém filtrou. Quem pediu "até 300 mil" disse
  // quanto pode pagar; um carro sem preço publicado não responde a isso.
  if (f.precoMin !== null) fora = fora.filter((v) => v.price != null && v.price >= f.precoMin);
  if (f.precoMax !== null) fora = fora.filter((v) => v.price != null && v.price <= f.precoMax);

  if (f.anoMin !== null) fora = fora.filter((v) => Number(v.year) >= f.anoMin);
  if (f.anoMax !== null) fora = fora.filter((v) => Number(v.year) <= f.anoMax);

  if (f.kmMax !== null) fora = fora.filter((v) => Number(v.mileage ?? 0) <= f.kmMax);

  // BLINDAGEM pelo campo de blindagem, não pelo badge. Badge é rótulo de
  // vitrine que alguém digita ("Novo", "Destaque"), então um carro blindado
  // marcado como "Destaque" ficava invisível para quem procurava blindado.
  if (f.blindagem === "sim") fora = fora.filter((v) => Boolean(v.blindagem?.blindado));
  if (f.blindagem === "nao") fora = fora.filter((v) => !v.blindagem?.blindado);

  const q = comparavel(f.busca);
  if (q) {
    // Marca, modelo e cor. A PLACA fica de fora de propósito: no site público
    // ela não é oferecida nem exposta, e busca por placa é ferramenta de
    // pátio, que já existe no /admin.
    fora = fora.filter((v) => comparavel(`${v.brand} ${v.model} ${v.color}`).includes(q));
  }

  return fora;
}

/** Ordena uma CÓPIA — a lista de origem é a fonte e não se mexe nela. */
export function ordenaVeiculos(veiculos, ordem) {
  const out = Array.isArray(veiculos) ? [...veiculos] : [];
  const qual = ORDENS_VALIDAS.has(ordem) ? ordem : FILTROS_VAZIOS.ordem;

  // Carro sem preço vai para o FIM das duas ordenações de preço. Em subtração
  // um null vira 0 e "Sob consulta" lideraria a lista de "menor preço",
  // respondendo a pergunta errada.
  const porPreco = (dir) => (a, b) => {
    if (a.price == null && b.price == null) return 0;
    if (a.price == null) return 1;
    if (b.price == null) return -1;
    return dir * (a.price - b.price);
  };

  switch (qual) {
    case "precoAsc":
      return out.sort(porPreco(1));
    case "precoDesc":
      return out.sort(porPreco(-1));
    case "anoDesc":
      return out.sort((a, b) => Number(b.year) - Number(a.year));
    case "kmAsc":
      return out.sort((a, b) => Number(a.mileage ?? 0) - Number(b.mileage ?? 0));
    case "recentes":
    default:
      // Data de CADASTRO, não ano do carro. Ordenava por `year`, então um 2026
      // cadastrado há meses vinha antes de um 2019 que entrou ontem — são
      // perguntas diferentes, e hoje a lista oferece as duas.
      return out.sort(
        (a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0)
      );
  }
}

/** Os valores distintos de um campo, em ordem, para montar a lista de opções. */
export function opcoesDe(veiculos, campo) {
  const vistos = new Set(
    (Array.isArray(veiculos) ? veiculos : []).map((v) => v?.[campo]).filter(Boolean)
  );
  return [...vistos].sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
}

/**
 * Os modelos que fazem sentido oferecer.
 *
 * Depende da marca porque "Macan" numa lista com BMW selecionado é uma opção
 * que só pode dar lista vazia. Sem marca escolhida, oferece tudo.
 */
export function modelosDisponiveis(veiculos, marcasSelecionadas) {
  const marcas = lista(marcasSelecionadas);
  const base = marcas.length
    ? (veiculos || []).filter((v) => marcas.includes(v.brand))
    : veiculos || [];
  return opcoesDe(base, "model");
}

const MIL = (n) => Number(n).toLocaleString("pt-BR");

/**
 * Os chips do que está ativo, cada um sabendo como se remover.
 *
 * A ORDENAÇÃO NÃO VIRA CHIP: ordenar não esconde carro nenhum, e um chip
 * "Menor preço ×" sugeriria que há algo filtrado que não há.
 */
export function chipsDe(filtros = FILTROS_VAZIOS) {
  const f = { ...FILTROS_VAZIOS, ...filtros };
  const chips = [];

  const doConjunto = (campo, valores) =>
    lista(valores).forEach((valor) =>
      chips.push({
        id: `${campo}:${valor}`,
        rotulo: valor,
        remover: (atual) => ({
          ...atual,
          [campo]: lista(atual[campo]).filter((v) => v !== valor),
        }),
      })
    );

  if (f.busca) {
    chips.push({
      id: "busca",
      rotulo: `"${f.busca}"`,
      remover: (atual) => ({ ...atual, busca: "" }),
    });
  }

  doConjunto("marcas", f.marcas);
  doConjunto("modelos", f.modelos);
  doConjunto("carrocerias", f.carrocerias);
  doConjunto("combustiveis", f.combustiveis);
  doConjunto("cambios", f.cambios);

  // Preço e ano viram UM chip com as duas pontas: dois chips separados para a
  // mesma faixa fazem o cliente remover metade e não entender o resultado.
  if (f.precoMin !== null || f.precoMax !== null) {
    const rotulo =
      f.precoMin !== null && f.precoMax !== null
        ? `R$ ${MIL(f.precoMin)}–${MIL(f.precoMax)}`
        : f.precoMin !== null
          ? `acima de R$ ${MIL(f.precoMin)}`
          : `até R$ ${MIL(f.precoMax)}`;
    chips.push({
      id: "preco",
      rotulo,
      remover: (atual) => ({ ...atual, precoMin: null, precoMax: null }),
    });
  }

  if (f.anoMin !== null || f.anoMax !== null) {
    const rotulo =
      f.anoMin !== null && f.anoMax !== null
        ? `${f.anoMin}–${f.anoMax}`
        : f.anoMin !== null
          ? `de ${f.anoMin}`
          : `até ${f.anoMax}`;
    chips.push({
      id: "ano",
      rotulo,
      remover: (atual) => ({ ...atual, anoMin: null, anoMax: null }),
    });
  }

  if (f.kmMax !== null) {
    chips.push({
      id: "km",
      rotulo: `até ${MIL(f.kmMax)} km`,
      remover: (atual) => ({ ...atual, kmMax: null }),
    });
  }

  if (f.blindagem !== "todos") {
    chips.push({
      id: "blindagem",
      rotulo: f.blindagem === "sim" ? "Blindado" : "Não blindado",
      remover: (atual) => ({ ...atual, blindagem: "todos" }),
    });
  }

  return chips;
}

/** Há algo escondendo carro? A ordenação não conta. */
export function temFiltroAtivo(filtros = FILTROS_VAZIOS) {
  return chipsDe(filtros).length > 0;
}

// Nome curto na URL → campo do filtro. Curto porque o link vai para o
// WhatsApp, onde URL comprida vira quebra de linha e desconfiança.
const MULTI = [
  ["marca", "marcas"],
  ["modelo", "modelos"],
  ["carroceria", "carrocerias"],
  ["combustivel", "combustiveis"],
  ["cambio", "cambios"],
];

const NUMEROS = [
  ["precoMin", "precoMin"],
  ["precoMax", "precoMax"],
  ["anoMin", "anoMin"],
  ["anoMax", "anoMax"],
  ["kmMax", "kmMax"],
];

/** Os filtros como query string. Filtro no padrão não escreve nada. */
export function filtrosParaQuery(filtros = FILTROS_VAZIOS) {
  const f = { ...FILTROS_VAZIOS, ...filtros };
  const sp = new URLSearchParams();

  if (f.busca) sp.set("busca", f.busca);
  for (const [chave, campo] of MULTI) {
    const vals = lista(f[campo]);
    if (vals.length) sp.set(chave, vals.join(","));
  }
  for (const [chave, campo] of NUMEROS) {
    if (f[campo] !== null) sp.set(chave, String(f[campo]));
  }
  if (f.blindagem !== "todos") sp.set("blindagem", f.blindagem);
  if (f.ordem !== FILTROS_VAZIOS.ordem) sp.set("ordem", f.ordem);

  return sp.toString();
}

/**
 * Os filtros lidos da URL.
 *
 * TUDO QUE NÃO RECONHECE VIRA PADRÃO. A query string é digitada, colada e
 * editada por gente — `anoMin=abc` não pode virar NaN e esvaziar a lista sem
 * explicação. Valor inválido se comporta como valor ausente.
 */
export function filtrosDaQuery(searchParams) {
  const sp =
    searchParams instanceof URLSearchParams
      ? searchParams
      : new URLSearchParams(searchParams || "");

  const f = { ...FILTROS_VAZIOS };

  f.busca = (sp.get("busca") || "").trim();

  for (const [chave, campo] of MULTI) {
    const cru = sp.get(chave);
    f[campo] = cru
      ? cru
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  }

  for (const [chave, campo] of NUMEROS) {
    f[campo] = numeroOuNull(sp.get(chave));
  }

  const blindagem = sp.get("blindagem");
  f.blindagem = BLINDAGENS.has(blindagem) ? blindagem : "todos";

  const ordem = sp.get("ordem");
  f.ordem = ORDENS_VALIDAS.has(ordem) ? ordem : FILTROS_VAZIOS.ordem;

  return f;
}
