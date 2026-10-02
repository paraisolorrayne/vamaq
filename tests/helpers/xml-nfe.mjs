/**
 * XML de NF-e autorizada (nfeProc 4.00) para os testes da devolução.
 *
 * Mesma estrutura do que a Focus devolve e do que o escritório manda: NFe +
 * protNFe, namespace padrão, grupo do ICMS aninhado (ICMS > ICMS20) e o total
 * repetindo `vBC` fora do item — que é justamente onde um leitor ingênuo pega
 * o número errado.
 */

export const CHAVE_VENDA = "31260845348469000154550020000000011670815997";
export const CHAVE_ENTRADA_ESCRITORIO = "31260845348469000154550010000000201000000209";

function dest({ doc, nome, ie, uf = "MG", municipio = "Uberlandia" }) {
  const tagDoc = doc.length === 14 ? "CNPJ" : "CPF";
  return `<dest><${tagDoc}>${doc}</${tagDoc}><xNome>${nome}</xNome><enderDest><xLgr>Rua das Flores</xLgr><nro>100</nro><xBairro>Centro</xBairro><cMun>3170206</cMun><xMun>${municipio}</xMun><UF>${uf}</UF><CEP>38400100</CEP><cPais>1058</cPais><xPais>BRASIL</xPais></enderDest><indIEDest>${ie ? 1 : 9}</indIEDest>${ie ? `<IE>${ie}</IE>` : ""}</dest>`;
}

function envelope({ chave, ide, destXml, dets, vNF }) {
  return `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe${chave}" versao="4.00">${ide}<emit><CNPJ>45348469000154</CNPJ><xNome>VAMAQ MOTORS LTDA</xNome><enderEmit><xLgr>Av Joao Naves de Avila</xLgr><nro>1</nro><xBairro>Centro</xBairro><cMun>3170206</cMun><xMun>Uberlandia</xMun><UF>MG</UF><CEP>38400000</CEP></enderEmit><IE>0054803330093</IE><CRT>3</CRT></emit>${destXml}${dets}<total><ICMSTot><vBC>99999.99</vBC><vICMS>11111.11</vICMS><vProd>${vNF}</vProd><vNF>${vNF}</vNF></ICMSTot></total><transp><modFrete>9</modFrete></transp><pag><detPag><tPag>99</tPag><vPag>${vNF}</vPag></detPag></pag></infNFe></NFe><protNFe versao="4.00"><infProt><tpAmb>1</tpAmb><chNFe>${chave}</chNFe><nProt>131267805126821</nProt><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe></nfeProc>`;
}

function ide({ natOp, serie, nNF, tpNF, idDest = 1, finNFe = 1 }) {
  return `<ide><cUF>31</cUF><cNF>67081599</cNF><natOp>${natOp}</natOp><mod>55</mod><serie>${serie}</serie><nNF>${nNF}</nNF><dhEmi>2026-08-18T10:00:00-03:00</dhEmi><tpNF>${tpNF}</tpNF><idDest>${idDest}</idDest><cMunFG>3170206</cMunFG><tpImp>1</tpImp><tpEmis>1</tpEmis><tpAmb>1</tpAmb><finNFe>${finNFe}</finNFe><indFinal>1</indFinal><indPres>1</indPres></ide>`;
}

/** Venda (5102) com ICMS sobre a margem, PIS/COFINS e IBS/CBS — como a NF 1 série 2. */
export function xmlVenda({
  chave = CHAVE_VENDA,
  cfop = "5102",
  idDest = 1,
  comprador = { doc: "52998224725", nome: "Maria Compradora" },
  chassi = "WP1AA2923GKA14408",
  semIbsCbs = false,
  itens = 1,
  finNFe = 1,
} = {}) {
  const det = (n) =>
    `<det nItem="${n}"><prod><cProd>PAS4I58</cProd><cEAN>SEM GTIN</cEAN><xProd>Porsche Cayenne 2016 - Placa PAS4I58 - Chassi ${chassi}</xProd><NCM>87032100</NCM><CFOP>${cfop}</CFOP><uCom>UN</uCom><qCom>1.0000</qCom><vUnCom>330000.0000000000</vUnCom><vProd>330000.00</vProd><uTrib>UN</uTrib><qTrib>1.0000</qTrib><vUnTrib>330000.0000000000</vUnTrib><indTot>1</indTot></prod><imposto><ICMS><ICMS20><orig>0</orig><CST>20</CST><modBC>3</modBC><pRedBC>95.2380</pRedBC><vBC>15715.40</vBC><pICMS>5.0000</pICMS><vICMS>785.77</vICMS></ICMS20></ICMS><PIS><PISAliq><CST>01</CST><vBC>14929.63</vBC><pPIS>0.6500</pPIS><vPIS>97.04</vPIS></PISAliq></PIS><COFINS><COFINSAliq><CST>01</CST><vBC>14929.63</vBC><pCOFINS>3.0000</pCOFINS><vCOFINS>447.89</vCOFINS></COFINSAliq></COFINS>${
      semIbsCbs
        ? ""
        : `<IBSCBS><CST>000</CST><cClassTrib>000001</cClassTrib><gIBSCBS><vBC>330000.00</vBC><gIBSUF><pIBSUF>0.1000</pIBSUF><vIBSUF>330.00</vIBSUF></gIBSUF><gIBSMun><pIBSMun>0.0000</pIBSMun><vIBSMun>0.00</vIBSMun></gIBSMun><vIBS>330.00</vIBS><gCBS><pCBS>0.9000</pCBS><vCBS>2970.00</vCBS></gCBS></gIBSCBS></IBSCBS>`
    }</imposto></det>`;
  return envelope({
    chave,
    ide: ide({ natOp: "Venda Dentro do Estado", serie: 2, nNF: 1, tpNF: 1, idDest, finNFe }),
    destXml: dest(comprador),
    dets: Array.from({ length: itens }, (_, i) => det(i + 1)).join(""),
    vNF: "330000.00",
  });
}

/** Entrada de compra de pessoa física (1102), CST 41 e PIS/COFINS 07 — como as NF 14/15 do escritório. */
export function xmlEntrada({
  chave = CHAVE_ENTRADA_ESCRITORIO,
  cfop = "1102",
  vendedor = { doc: "52998224725", nome: "Joao Vendedor" },
  chassi = "WP1AA2923GKA14408",
  serie = 1,
} = {}) {
  const det = `<det nItem="1"><prod><cProd>PAS4I58</cProd><cEAN>SEM GTIN</cEAN><xProd>PORSCHE CAYENNE 2016 CHASSI ${chassi}</xProd><NCM>87032100</NCM><CFOP>${cfop}</CFOP><uCom>UN</uCom><qCom>1.0000</qCom><vUnCom>160000.0000000000</vUnCom><vProd>160000.00</vProd><indTot>1</indTot></prod><imposto><ICMS><ICMS40><orig>0</orig><CST>41</CST></ICMS40></ICMS><PIS><PISNT><CST>07</CST></PISNT></PIS><COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS></imposto></det>`;
  return envelope({
    chave,
    ide: ide({ natOp: "Compra Dentro do Estado", serie, nNF: 20, tpNF: 0 }),
    destXml: dest(vendedor),
    dets: det,
    vNF: "160000.00",
  });
}
