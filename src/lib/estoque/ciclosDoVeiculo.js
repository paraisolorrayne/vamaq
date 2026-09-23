/**
 * As linhas do relatório de entradas e saídas, um ciclo por linha.
 *
 * O ciclo CORRENTE do carro vive nas colunas de `vehicles` (data_entrada,
 * data_saida, price); os ENCERRADOS, em `vehicle_ciclos`. Sem unir os dois, a
 * compra original do carro que voltou na troca desaparece do relatório — e ele
 * é justamente o registro de entrada e saída do pátio.
 *
 * Puro de propósito: sem banco e sem alias "@/", para rodar em `node --test`.
 * Mesmo padrão de src/lib/estoque/listaVeiculos.js.
 */

/** "2026-01-10" a partir de Date ou string; null vira null. */
function dia(valor) {
  return valor ? String(valor).slice(0, 10) : null;
}

/**
 * Zero NÃO é valor: a margem devolve 0 para carro sem lançamento nenhum, e
 * "R$ 0,00" na coluna Compra se lê como "comprado de graça". Ausência de
 * lançamento tem que aparecer como ausência. (Regra herdada da versão anterior
 * desta tela — não relaxar.)
 */
function valorOuNulo(n) {
  return n > 0 ? n : null;
}

export function linhasComCiclos({ veiculos, ciclos, margens } = {}) {
  const carros = Array.isArray(veiculos) ? veiculos : [];
  const encerrados = Array.isArray(ciclos) ? ciclos : [];
  const margem = new Map(
    (Array.isArray(margens) ? margens : []).map((m) => [`${m.vehicle_id}|${m.ciclo}`, m])
  );

  const linhas = [];
  for (const v of carros) {
    const cicloAtual = Number(v.ciclo) || 1;
    const meus = encerrados
      .filter((c) => c.vehicle_id === v.id)
      .sort((a, b) => a.ciclo - b.ciclo);
    const total = meus.length + 1;

    const monta = (ciclo, dataEntrada, dataSaida) => {
      const m = margem.get(`${v.id}|${ciclo}`);
      const compra = m ? valorOuNulo(m.custo_aquisicao) : null;
      const venda = m ? valorOuNulo(m.receita) : null;
      return {
        id: v.id,
        ciclo,
        ciclosDoCarro: total,
        brand: v.brand,
        model: v.model,
        year: v.year,
        ano_modelo: v.ano_modelo,
        placa: v.placa,
        chassi: v.chassi,
        // O status é o do carro HOJE; num ciclo encerrado ele não descreve
        // aquele ciclo, e por isso a tela só o usa na linha corrente.
        status: v.status,
        data_entrada: dia(dataEntrada),
        data_saida: dia(dataSaida),
        compra,
        venda,
        resultado: compra !== null || venda !== null ? m.resultado_liquido : null,
      };
    };

    for (const c of meus) linhas.push(monta(c.ciclo, c.data_entrada, c.data_saida));
    linhas.push(monta(cicloAtual, v.data_entrada, v.data_saida));
  }
  return linhas;
}
