/**
 * O que entra em cada cena da home cinematográfica. Puro — sem I/O e sem
 * imports —, para rodar em `node --test`.
 *
 * A regra de todas as cenas: só sai o que está no cadastro. As fotos não têm
 * etiqueta (externa, roda, interior) e a ordem muda de carro para carro — o
 * 911 abre de lado, o X6 abre de frente e põe o interior no meio. Por isso
 * nenhuma legenda diz o que a foto mostra.
 */

const CARROS_NA_VITRINE = 5;

export function fotosDoVeiculo(veiculo) {
  const imagens = veiculo?.images;
  if (!imagens) return [];
  const galeria = Array.isArray(imagens.gallery) ? imagens.gallery : [];
  const lista = [];
  for (const url of [imagens.main, ...galeria]) {
    if (url && !lista.includes(url)) lista.push(url);
  }
  return lista;
}

export function formatarPreco(veiculo) {
  return veiculo?.price
    ? veiculo.price.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
    : "Sob consulta";
}

export function formatarKm(veiculo) {
  return `${(Number(veiculo?.mileage) || 0).toLocaleString("pt-BR")} km`;
}

function maisNovosPrimeiro(veiculos) {
  return [...veiculos].sort(
    (a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0)
  );
}

/**
 * Herói = primeiro destaque com foto. Vitrine = os outros destaques e depois
 * os mais recentes, sem repetir o herói. Carro sem foto não entra em cena
 * nenhuma: as duas são feitas de foto.
 */
export function escolherCenas(destaques, estoque) {
  const comFoto = (v) => fotosDoVeiculo(v).length > 0;
  const hero = destaques.find(comFoto) || estoque.find(comFoto) || null;
  const vistos = new Set(hero ? [hero.id] : []);
  const vitrine = [];
  for (const v of [...destaques, ...maisNovosPrimeiro(estoque)]) {
    if (vitrine.length >= CARROS_NA_VITRINE) break;
    if (vistos.has(v.id) || !comFoto(v)) continue;
    vistos.add(v.id);
    vitrine.push(v);
  }
  return { hero, vitrine };
}
