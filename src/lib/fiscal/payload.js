/**
 * Monta o corpo da NF-e (modelo 55) enviado à Focus NFe.
 *
 * Puro de propósito: sem banco e sem rede, para o teste rodar em `node --test`
 * (o alias "@/" não resolve lá — por isso o import de calc.js é relativo).
 *
 * Nenhum valor fiscal é inventado aqui: CFOP, CST, NCM e série vêm de
 * `fiscal_config`, preenchida pelo contador. Faltou parâmetro, a função recusa
 * em vez de chutar.
 */
import { icmsSeminovo, round2 } from "../fin/calc.js";

const so_digitos = (v) => String(v ?? "").replace(/\D/g, "");

/** Campos do endereço do destinatário, com o rótulo que a tela usa. */
const CAMPOS_DESTINATARIO = [
  ["nome", "nome"],
  ["doc", "CPF/CNPJ"],
  ["cep", "CEP"],
  ["logradouro", "logradouro"],
  ["numero", "número"],
  ["bairro", "bairro"],
  ["municipio", "município"],
  ["uf", "UF"],
];

const CAMPOS_CONFIG = [
  ["cnpj", "CNPJ do emitente"],
  ["cfop", "CFOP"],
  ["cst", "CST"],
  ["ncm", "NCM"],
  ["serie", "série"],
];

// Situações tributárias do ICMS no regime normal (a Vamaq é Lucro Presumido,
// então é CST, não CSOSN). A Focus é a autoridade final — esta lista existe
// para o erro aparecer AQUI, com instrução, em vez de voltar da SEFAZ como
// "Situacao tributaria (ICMS) invalida" no meio de uma emissão.
const CST_ICMS_VALIDOS = ["00", "10", "20", "30", "40", "41", "50", "51", "60", "70", "90"];

/**
 * O CST do ICMS tem DOIS dígitos; a origem da mercadoria vai em campo próprio.
 *
 * Contador costuma escrever a forma combinada de três dígitos, que é como sai
 * na DANFE: origem + CST. Foi o que aconteceu aqui — veio "020" (origem 0 +
 * CST 20), foi gravado inteiro no campo do CST, e a SEFAZ recusou.
 *
 * Aceitamos as duas formas. Com três dígitos, o primeiro TEM que bater com a
 * origem gravada: se não bater, são duas informações se contradizendo e
 * adivinhar qual vale seria pior que recusar.
 */
export function normalizaCstIcms(cst, origem) {
  const c = String(cst ?? "").trim();
  const o = String(origem ?? "").trim();

  if (/^\d{2}$/.test(c)) return { cst: c };
  if (/^\d{3}$/.test(c)) {
    if (o && c[0] !== o) {
      return {
        error: `CST "${c}" começa com origem ${c[0]}, mas a origem cadastrada é ${o}. Confirme os dois com o contador.`,
      };
    }
    return { cst: c.slice(1) };
  }
  return { error: `CST "${c}" não tem formato de situação tributária. Peça ao contador o CST do ICMS (dois dígitos).` };
}

export function montarPayloadNfe({ config, veiculo, destinatario, valorVenda, custoAquisicao }) {
  const venda = Number(valorVenda) || 0;
  if (venda <= 0) return { error: "Informe o valor da venda." };

  for (const [campo, rotulo] of CAMPOS_CONFIG) {
    if (!config?.[campo]) {
      return { error: `Parâmetro fiscal ausente: ${rotulo}. Peça ao contador.` };
    }
  }
  if (!veiculo?.chassi) return { error: "O veículo está sem chassi. Preencha no cadastro." };
  for (const [campo, rotulo] of CAMPOS_DESTINATARIO) {
    if (!destinatario?.[campo]) return { error: `Destinatário sem ${rotulo}.` };
  }

  // O CST vem do contador e pode chegar na forma combinada (origem + CST).
  const cstNormalizado = normalizaCstIcms(config.cst, config.origem);
  if (cstNormalizado.error) return { error: cstNormalizado.error };
  if (!CST_ICMS_VALIDOS.includes(cstNormalizado.cst)) {
    return {
      error: `CST do ICMS "${cstNormalizado.cst}" não é uma situação tributária do regime normal. Confirme com o contador.`,
    };
  }

  const aliquota = Number(config.icms_seminovo_aliquota ?? 5);
  const custo = Number(custoAquisicao) || 0;
  const base = round2(Math.max(0, venda - custo));
  const icms = icmsSeminovo(venda, custo, aliquota);

  const doc = so_digitos(destinatario.doc);
  if (doc.length !== 11 && doc.length !== 14) {
    return { error: "CPF/CNPJ do destinatário inválido." };
  }
  const ehCnpj = doc.length === 14;

  const descricao = [
    `${veiculo.brand} ${veiculo.model} ${veiculo.year}`,
    veiculo.placa ? `Placa ${veiculo.placa}` : null,
    `Chassi ${veiculo.chassi}`,
  ].filter(Boolean).join(" - ");

  const payload = {
    natureza_operacao: "Venda de mercadoria",
    // Estruturais da NF-e de venda (não vêm do contador, são constantes do domínio):
    data_emissao: new Date().toISOString(),
    tipo_documento: 1, // 1 = saída
    finalidade_emissao: 1, // 1 = normal
    serie: String(config.serie),
    cnpj_emitente: so_digitos(config.cnpj),
    nome_destinatario: destinatario.nome,
    [ehCnpj ? "cnpj_destinatario" : "cpf_destinatario"]: doc,
    cep_destinatario: so_digitos(destinatario.cep),
    logradouro_destinatario: destinatario.logradouro,
    numero_destinatario: String(destinatario.numero),
    bairro_destinatario: destinatario.bairro,
    municipio_destinatario: destinatario.municipio,
    uf_destinatario: destinatario.uf,
    valor_total: venda,
    items: [
      {
        numero_item: 1,
        codigo_produto: veiculo.placa || veiculo.chassi,
        descricao,
        codigo_ncm: String(config.ncm),
        cfop: String(config.cfop),
        unidade_comercial: "UN",
        quantidade_comercial: 1,
        valor_unitario_comercial: venda,
        valor_bruto: venda,
        icms_situacao_tributaria: cstNormalizado.cst,
        icms_base_calculo: base,
        icms_aliquota: aliquota,
        icms_valor: icms,
        ...(config.origem ? { icms_origem: String(config.origem) } : {}),
        ...(config.icms_modalidade_base_calculo
          ? { icms_modalidade_base_calculo: String(config.icms_modalidade_base_calculo) }
          : {}),
      },
    ],
  };

  return { payload, impostos: { base, aliquota, icms } };
}
