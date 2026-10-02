/**
 * Lê o XML de uma NF-e autorizada — o que a devolução precisa saber da nota
 * original.
 *
 * POR QUE O XML E NÃO O NOSSO BANCO: a nota a devolver pode ter sido emitida
 * pelo escritório (série 1), e dessa o sistema não tem nada. E mesmo a nossa:
 * os impostos da devolução de venda têm que repetir os da venda, e o único
 * registro fiel do que a SEFAZ autorizou é o XML. Recalcular a partir da
 * config de hoje daria outro número se a config mudou desde então.
 *
 * Puro e sem dependência: NF-e é XML plano, sem prefixo de namespace, e só
 * lemos tags conhecidas. Cada leitura é feita DENTRO do bloco certo — `vBC`
 * aparece no ICMS, no PIS, no COFINS, no IBS/CBS e no total da nota, e pegar o
 * primeiro do documento é pegar o número errado.
 */

/** Conteúdo do primeiro `<tag ...>...</tag>` — nome exato, não prefixo (ICMS ≠ ICMSTot). */
function bloco(xml, tag) {
  if (!xml) return "";
  const m = String(xml).match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  return m ? m[1] : "";
}

/** Todos os blocos `<tag>` — para contar os itens. */
function blocos(xml, tag) {
  if (!xml) return [];
  return [...String(xml).matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g"))].map(
    (m) => m[1]
  );
}

function texto(xml, tag) {
  return bloco(xml, tag).trim();
}

/** Número do XML ("15715.40") ou null quando a tag não existe. */
function numero(xml, tag) {
  const t = texto(xml, tag);
  return t === "" ? null : Number(t);
}

/** O grupo do ICMS vem aninhado num filho que diz a situação: ICMS > ICMS20. */
function lerIcms(imposto) {
  const grupo = bloco(imposto, "ICMS");
  return {
    origem: texto(grupo, "orig"),
    cst: texto(grupo, "CST"),
    modalidadeBase: texto(grupo, "modBC"),
    reducaoBase: numero(grupo, "pRedBC"),
    baseCalculo: numero(grupo, "vBC"),
    aliquota: numero(grupo, "pICMS"),
    valor: numero(grupo, "vICMS"),
  };
}

/** PIS e COFINS: PISAliq/PISNT têm a mesma forma, só muda o sufixo da alíquota. */
function lerContribuicao(imposto, tag) {
  const grupo = bloco(imposto, tag);
  return {
    cst: texto(grupo, "CST"),
    baseCalculo: numero(grupo, "vBC"),
    aliquota: numero(grupo, `p${tag}`),
    valor: numero(grupo, `v${tag}`),
  };
}

/** Reforma tributária. Nota emitida sem o grupo devolve null. */
function lerIbsCbs(imposto) {
  const grupo = bloco(imposto, "IBSCBS");
  if (!grupo) return null;
  const valores = bloco(grupo, "gIBSCBS");
  const uf = bloco(valores, "gIBSUF");
  const mun = bloco(valores, "gIBSMun");
  const cbs = bloco(valores, "gCBS");
  return {
    cst: texto(grupo, "CST"),
    classificacao: texto(grupo, "cClassTrib"),
    baseCalculo: numero(valores, "vBC"),
    ibsUfAliquota: numero(uf, "pIBSUF"),
    ibsUfValor: numero(uf, "vIBSUF"),
    ibsMunAliquota: numero(mun, "pIBSMun"),
    ibsMunValor: numero(mun, "vIBSMun"),
    cbsAliquota: numero(cbs, "pCBS"),
    cbsValor: numero(cbs, "vCBS"),
  };
}

// Chassi tem 17 caracteres, sem I, O e Q.
const CHASSI = /\b[A-HJ-NPR-Z0-9]{17}\b/;

/**
 * @returns {{ error: string } | {
 *   chave, numero, serie, tipoDocumento, finalidade, localDestino,
 *   emitenteCnpj, valorTotal, contraparte, item, quantidadeItens, chassi
 * }}
 */
export function lerNotaXml(xml) {
  const doc = String(xml ?? "");
  const infNFe = bloco(doc, "infNFe");
  if (!infNFe) {
    return {
      error:
        "Este arquivo não parece ser o XML de uma nota fiscal. Peça à contabilidade o arquivo .xml da nota (não o PDF da DANFE).",
    };
  }

  const ide = bloco(infNFe, "ide");
  const dest = bloco(infNFe, "dest");
  const ender = bloco(dest, "enderDest");
  const dets = blocos(infNFe, "det");
  const det = dets[0] || "";
  const prod = bloco(det, "prod");
  const imposto = bloco(det, "imposto");

  // A chave do protocolo é a autorizada; o Id do infNFe ("NFe" + 44) é o
  // reserva, para XML que veio sem o protNFe.
  const idInf = (doc.match(/<infNFe[^>]*\sId="NFe(\d{44})"/) || [])[1];
  const chave = texto(bloco(doc, "protNFe"), "chNFe") || idInf || "";

  const descricao = texto(prod, "xProd");
  const chassiVeic = texto(bloco(det, "veicProd"), "chassi");

  return {
    chave,
    numero: texto(ide, "nNF"),
    serie: texto(ide, "serie"),
    tipoDocumento: Number(texto(ide, "tpNF")),
    finalidade: Number(texto(ide, "finNFe")),
    localDestino: Number(texto(ide, "idDest")) || 1,
    emitenteCnpj: texto(bloco(infNFe, "emit"), "CNPJ"),
    valorTotal: numero(bloco(infNFe, "ICMSTot"), "vNF") ?? 0,
    contraparte: {
      nome: texto(dest, "xNome"),
      doc: texto(dest, "CPF") || texto(dest, "CNPJ"),
      ie: texto(dest, "IE"),
      cep: texto(ender, "CEP"),
      logradouro: texto(ender, "xLgr"),
      numero: texto(ender, "nro"),
      bairro: texto(ender, "xBairro"),
      municipio: texto(ender, "xMun"),
      uf: texto(ender, "UF"),
    },
    quantidadeItens: dets.length,
    item: {
      codigo: texto(prod, "cProd"),
      descricao,
      ncm: texto(prod, "NCM"),
      cfop: texto(prod, "CFOP"),
      valor: numero(prod, "vProd") ?? 0,
      icms: lerIcms(imposto),
      pis: lerContribuicao(imposto, "PIS"),
      cofins: lerContribuicao(imposto, "COFINS"),
      ibsCbs: lerIbsCbs(imposto),
    },
    chassi: chassiVeic || (descricao.toUpperCase().match(CHASSI) || [])[0] || null,
  };
}
