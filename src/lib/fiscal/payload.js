/**
 * Monta o corpo da NF-e (modelo 55) enviado à Focus NFe.
 *
 * Puro de propósito: sem banco e sem rede, para o teste rodar em `node --test`
 * (o alias "@/" não resolve lá — por isso os imports são relativos).
 *
 * Nenhum valor fiscal é inventado aqui: CFOP, CST, NCM, série, alíquotas e
 * redução de base vêm de `fiscal_config`. Faltou parâmetro, a função recusa
 * em vez de chutar.
 *
 * OS NOMES DOS CAMPOS são os da referência oficial da Focus
 * (https://campos.focusnfe.com.br/nfe/NotaFiscalXML.html), conferidos um a um
 * em 12/08/2026. Não invente nome de campo: a Focus aceita o JSON e a recusa
 * só aparece depois, como "Erro na validação do Schema XML".
 */
import { round2 } from "../fin/calc.js";
import { impostosVeiculoUsado } from "./impostos.js";

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

/** 45348469000154 -> 45.348.469/0001-54 (como sai impresso na DANFE). */
function formataCnpj(doc) {
  const d = so_digitos(doc);
  if (d.length !== 14) return d;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** 150000 -> "150.000,00" */
function moedaBR(n) {
  const [inteiro, centavos] = round2(Number(n) || 0).toFixed(2).split(".");
  return `${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${centavos}`;
}

/**
 * Texto das informações complementares, no formato da NF 12 autorizada:
 *
 *   VEICULO USADO ADQ DE VAMAQ MOTORS, CNPJ 45.348.469/0001-54 CF NF 10
 *   VLR DE AQUISICAO R$150.000,00.
 *
 * O CNPJ é o da própria Vamaq porque a nota de aquisição (a de ENTRADA) é
 * emitida pela Vamaq — é o documento que comprova de onde o carro veio.
 *
 * `numeroNotaEntrada` fica de fora quando não é informado: hoje o sistema
 * ainda não emite notas de entrada, e inventar um número seria pior do que
 * omitir. Quando o módulo de entrada existir, ele preenche sozinho.
 */
export function textoInformacoesComplementares({ config, custoAquisicao, numeroNotaEntrada }) {
  const partes = [
    `VEICULO USADO ADQ DE ${config?.razao_social || "VAMAQ MOTORS"}, CNPJ ${formataCnpj(config?.cnpj)}`,
  ];
  const nf = String(numeroNotaEntrada ?? "").trim();
  if (nf) partes.push(`CF NF ${nf}`);
  partes.push(`VLR DE AQUISICAO R$${moedaBR(custoAquisicao)}.`);
  return partes.join(" ");
}

export function montarPayloadNfe({
  config,
  veiculo,
  destinatario,
  valorVenda,
  custoAquisicao,
  numeroNotaEntrada,
}) {
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

  const imp = impostosVeiculoUsado(venda, config);

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

  // indIEDest: 1 quando o destinatário é contribuinte e informou a IE;
  // 9 (não contribuinte) no resto — que é o caso de toda venda a pessoa física.
  const ieDestinatario = so_digitos(destinatario.ie);
  const ufEmitente = String(config.uf || "MG").trim().toUpperCase();
  const ufDestino = String(destinatario.uf).trim().toUpperCase();

  const payload = {
    natureza_operacao: config.natureza_operacao || "Venda Dentro do Estado",
    // Estruturais da NF-e de venda (não vêm do contador, são constantes do domínio):
    data_emissao: new Date().toISOString(),
    tipo_documento: 1, // 1 = saída
    finalidade_emissao: 1, // 1 = normal
    // idDest: 1 = operação interna, 2 = interestadual.
    local_destino: ufDestino === ufEmitente ? 1 : 2,
    serie: String(config.serie),
    cnpj_emitente: so_digitos(config.cnpj),

    // Os quatro campos abaixo são obrigatórios no schema da NF-e 4.00 e não
    // eram enviados. A SEFAZ recusa um por vez, então a falta deles apareceu
    // como uma fila de erros diferentes na tela da operadora (11/08/2026).
    modalidade_frete: String(config.modalidade_frete ?? "1"),
    presenca_comprador: String(config.presenca_comprador ?? "1"),
    consumidor_final: String(config.consumidor_final ?? "1"),
    ...(ieDestinatario
      ? {
          indicador_inscricao_estadual_destinatario: 1,
          inscricao_estadual_destinatario: ieDestinatario,
        }
      : { indicador_inscricao_estadual_destinatario: 9 }),

    nome_destinatario: destinatario.nome,
    [ehCnpj ? "cnpj_destinatario" : "cpf_destinatario"]: doc,
    cep_destinatario: so_digitos(destinatario.cep),
    logradouro_destinatario: destinatario.logradouro,
    numero_destinatario: String(destinatario.numero),
    bairro_destinatario: destinatario.bairro,
    municipio_destinatario: destinatario.municipio,
    uf_destinatario: ufDestino,
    valor_total: venda,

    // infCpl — a nota autorizada carrega a origem do veículo aqui.
    informacoes_adicionais_contribuinte: textoInformacoesComplementares({
      config,
      custoAquisicao,
      numeroNotaEntrada,
    }),

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
        icms_base_calculo: imp.baseIcms,
        icms_aliquota: imp.aliquotaIcms,
        icms_valor: imp.icms,
        // pRedBC: sem isto a base sai sem justificativa e não bate com o valor
        // do produto — é o campo que explica os 7.500,15 sobre 157.500,00.
        icms_reducao_base_calculo: imp.reducaoBaseIcms,
        ...(config.origem ? { icms_origem: String(config.origem) } : {}),
        // modBC 3 = valor da operação.
        icms_modalidade_base_calculo: String(config.icms_modalidade_base_calculo || "3"),

        pis_situacao_tributaria: String(config.pis_situacao_tributaria || "01"),
        pis_base_calculo: imp.basePisCofins,
        pis_aliquota_porcentual: imp.aliquotaPis,
        pis_valor: imp.pis,

        cofins_situacao_tributaria: String(config.cofins_situacao_tributaria || "01"),
        cofins_base_calculo: imp.basePisCofins,
        cofins_aliquota_porcentual: imp.aliquotaCofins,
        cofins_valor: imp.cofins,
      },
    ],
  };

  return { payload, impostos: imp };
}
