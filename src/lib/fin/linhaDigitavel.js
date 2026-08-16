/**
 * Leitura da linha digitável de boletos e contas de concessionária.
 *
 * PARA QUE SERVE: a secretária digita (ou escaneia) os números impressos
 * embaixo do código de barras e o sistema já sabe o valor — e, quando é
 * boleto, o vencimento. Menos digitação e, principalmente, menos erro de
 * valor: os dígitos verificadores pegam o número trocado na hora, em vez de a
 * loja descobrir na conciliação.
 *
 * SÃO DOIS FORMATOS DIFERENTES, e confundi-los é o erro clássico:
 *
 *   BOLETO BANCÁRIO — 47 dígitos. Traz valor E vencimento.
 *   CONCESSIONÁRIA (água, luz, gás, telefone) — 48 dígitos, começa com 8.
 *     Traz o valor. O vencimento vive no campo livre, em formato que cada
 *     concessionária escolhe, então NÃO é lido aqui: chutar data de conta de
 *     água é pior que pedir para digitar.
 *
 * Puro de propósito: sem banco e sem rede, para rodar em `node --test`.
 */

/** Só os dígitos — a pessoa cola com pontos, espaços e o que vier. */
export function apenasDigitos(texto) {
  return String(texto ?? "").replace(/\D/g, "");
}

/** Módulo 10 (blocos do boleto e de parte das concessionárias). */
export function mod10(bloco) {
  let soma = 0;
  let peso = 2;
  for (let i = bloco.length - 1; i >= 0; i--) {
    let n = Number(bloco[i]) * peso;
    if (n > 9) n -= 9;
    soma += n;
    peso = peso === 2 ? 1 : 2;
  }
  const resto = soma % 10;
  return resto === 0 ? 0 : 10 - resto;
}

/** Módulo 11 com pesos 2..9 (blocos de concessionária com identificador 8 ou 9). */
export function mod11Bloco(bloco) {
  let soma = 0;
  let peso = 2;
  for (let i = bloco.length - 1; i >= 0; i--) {
    soma += Number(bloco[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  if (resto === 0) return 0;
  if (resto === 1) return 1; // convenção da FEBRABAN para arrecadação
  return 11 - resto;
}

/**
 * Fator de vencimento -> data.
 *
 * O fator conta dias desde 07/10/1997 e ia até 9999, que caiu em 21/02/2025.
 * A partir dali ele REINICIOU em 1000 (22/02/2025). Como as contas que a loja
 * paga são atuais, usamos o ciclo novo — e se a data sair absurda (mais de
 * cinco anos fora de agora), devolvemos null em vez de uma data errada, que
 * seria pior que data nenhuma.
 */
export function dataDoFator(fator, hoje = null) {
  const f = Number(fator);
  if (!Number.isFinite(f) || f < 1000 || f > 9999) return null;

  const base = Date.UTC(2025, 1, 22); // 22/02/2025 = fator 1000 no ciclo novo
  const data = new Date(base + (f - 1000) * 86400000);

  const referencia = hoje ? new Date(`${hoje}T00:00:00Z`) : new Date();
  const anos = Math.abs(data.getTime() - referencia.getTime()) / (365.25 * 86400000);
  if (anos > 5) return null;

  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(data.getUTCDate()).padStart(2, "0");
  return `${data.getUTCFullYear()}-${mes}-${dia}`;
}

/** 47 dígitos da linha -> 44 do código de barras. */
function boletoLinhaParaBarras(d) {
  const campo1 = d.slice(0, 9);
  const campo2 = d.slice(10, 20);
  const campo3 = d.slice(21, 31);
  const dvGeral = d[32];
  const campo5 = d.slice(33, 47);
  return campo1.slice(0, 4) + dvGeral + campo5 + campo1.slice(4) + campo2 + campo3;
}

function leBoleto(d) {
  // Cada um dos três primeiros campos carrega o próprio DV mod10 — é o que
  // pega dígito trocado na digitação.
  const campos = [
    [d.slice(0, 9), d[9]],
    [d.slice(10, 20), d[20]],
    [d.slice(21, 31), d[31]],
  ];
  for (const [bloco, dv] of campos) {
    if (mod10(bloco) !== Number(dv)) {
      return { error: "Os números não conferem. Confira a linha digitável do boleto." };
    }
  }

  const valorBruto = d.slice(37, 47);
  const valor = Number(valorBruto) / 100;
  return {
    tipo: "boleto",
    codigoBarras: boletoLinhaParaBarras(d),
    valor: valor > 0 ? valor : null,
    vencimento: dataDoFator(d.slice(33, 37)),
  };
}

/** 48 dígitos (4 blocos de 11 + DV) -> 44 do código de barras. */
function concessionariaLinhaParaBarras(d) {
  return [0, 12, 24, 36].map((i) => d.slice(i, i + 11)).join("");
}

function leConcessionaria(d) {
  const barras = concessionariaLinhaParaBarras(d);
  // 3º dígito diz qual módulo valida os blocos: 6 e 7 -> mod10; 8 e 9 -> mod11.
  const identificador = barras[2];
  if (!"6789".includes(identificador)) {
    return { error: "Código de arrecadação não reconhecido. Confira os números." };
  }
  const calcula = identificador === "8" || identificador === "9" ? mod11Bloco : mod10;

  for (let i = 0; i < 4; i++) {
    const bloco = d.slice(i * 12, i * 12 + 11);
    const dv = Number(d[i * 12 + 11]);
    if (calcula(bloco) !== dv) {
      return { error: "Os números não conferem. Confira a linha digitável da conta." };
    }
  }

  const valor = Number(barras.slice(4, 15)) / 100;
  return {
    tipo: "concessionaria",
    codigoBarras: barras,
    valor: valor > 0 ? valor : null,
    // De propósito: cada concessionária põe a data onde quer no campo livre.
    vencimento: null,
  };
}

/**
 * Lê uma linha digitável colada, digitada ou vinda do leitor de código de
 * barras. Devolve `{ tipo, valor, vencimento, codigoBarras }` ou `{ error }`
 * com uma frase que a operadora entende.
 */
export function leLinhaDigitavel(texto) {
  const d = apenasDigitos(texto);
  if (!d) return { error: "Digite ou cole os números da conta." };
  if (d.length === 47) return leBoleto(d);
  if (d.length === 48) return leConcessionaria(d);
  if (d.length === 44) {
    return {
      error:
        "Isso parece o código de barras (44 dígitos). Use a linha digitável, os números impressos logo abaixo dele.",
    };
  }
  return {
    error: `A conta tem ${d.length} dígito${d.length === 1 ? "" : "s"} — boleto tem 47 e conta de concessionária tem 48. Confira se copiou tudo.`,
  };
}
