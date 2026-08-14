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
  vendaPresencial = true,
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

  // Contador, 14/08/2026: o texto das informações complementares é obrigatório
  // E tem que estar preenchido. Sem o número da nota de entrada ele sai pela
  // metade — e não existe carro para vender que não tenha entrado antes.
  //
  // Vem DEPOIS das checagens de config: CST ou CFOP errados travam toda
  // emissão e são problema do contador. Mandar a operadora buscar o número da
  // nota de entrada para depois esbarrar num parâmetro errado é fazê-la
  // trabalhar à toa.
  if (!String(numeroNotaEntrada ?? "").trim()) {
    return {
      error:
        "Informe o número da nota de entrada deste veículo — ela é obrigatória nas informações complementares da nota de venda.",
    };
  }

  const imp = impostosVeiculoUsado(venda, custoAquisicao, config);
  // Desligável por configuração: se a SEFAZ recusar o grupo da reforma, é um
  // UPDATE — e o contador avisou que ainda não há multa por não informar.
  const ibsCbsAtivo = config.ibs_cbs_ativo !== false;

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

  // Contador, 14/08/2026: o CFOP muda para 6102 APENAS quando a venda não é
  // presencial. Comprador de outro estado que vem à loja e leva o carro fez uma
  // operação interna — o fato gerador aconteceu em MG. Só venda a distância
  // para outra UF é interestadual.
  const interestadual = !vendaPresencial && ufDestino !== ufEmitente;
  const cfop = interestadual ? String(config.cfop_interestadual || "6102") : String(config.cfop);
  const presenca = vendaPresencial ? String(config.presenca_comprador ?? "1") : "2";

  const payload = {
    natureza_operacao: config.natureza_operacao || "Venda Dentro do Estado",
    // Estruturais da NF-e de venda (não vêm do contador, são constantes do domínio):
    data_emissao: new Date().toISOString(),
    tipo_documento: 1, // 1 = saída
    finalidade_emissao: 1, // 1 = normal
    // idDest: 1 = operação interna, 2 = interestadual. Acompanha o CFOP.
    local_destino: interestadual ? 2 : 1,
    serie: String(config.serie),
    cnpj_emitente: so_digitos(config.cnpj),

    // Os quatro campos abaixo são obrigatórios no schema da NF-e 4.00 e não
    // eram enviados. A SEFAZ recusa um por vez, então a falta deles apareceu
    // como uma fila de erros diferentes na tela da operadora (11/08/2026).
    // 9 = sem ocorrência de transporte. As notas antigas saíram com 1 (por conta
    // do destinatário); o contador corrigiu em 14/08/2026 — o comprador sai
    // dirigindo, não há transporte nenhum a declarar.
    modalidade_frete: String(config.modalidade_frete ?? "9"),
    presenca_comprador: presenca,
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

    // Grupo de pagamento (obrigatório na NF-e 4.00). Contador: a prazo — a venda
    // é financiada por banco, não é dinheiro na hora. tPag 99 exige descrição.
    formas_pagamento: [
      {
        indicador_pagamento: String(config.indicador_pagamento ?? "1"),
        forma_pagamento: String(config.forma_pagamento || "99"),
        ...(String(config.forma_pagamento || "99") === "99"
          ? { descricao_pagamento: String(config.descricao_pagamento || "A prazo") }
          : {}),
        valor_pagamento: venda,
      },
    ],

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
        cfop,
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

        // Reforma tributária — obrigatório desde 03/08/2026. O contador foi
        // específico em 14/08/2026: CST 000, cClassTrib 000001, IBS 0,10%
        // inteiro na competência estadual, CBS 0,90%, e a base é o VALOR TOTAL
        // DA NOTA (não a margem, como eu tinha assumido).
        //
        // `bem_movel_usado` (indBemMovelUsado) NÃO vai: eu o mandava para
        // justificar a base reduzida pela margem. Com a base no valor cheio a
        // justificativa deixou de existir, e o contador listou exatamente estes
        // campos — mandar um indicador a mais por conta própria é como a fila
        // de recusas de 11/08 começou.
        ...(ibsCbsAtivo
          ? {
              ibs_cbs_situacao_tributaria: String(config.ibs_cbs_situacao_tributaria || "000"),
              ibs_cbs_classificacao_tributaria: String(
                config.ibs_cbs_classificacao_tributaria || "000001"
              ),
              ibs_cbs_base_calculo: imp.baseIbsCbs,
              ibs_uf_aliquota: imp.aliquotaIbsUf,
              ibs_uf_valor: imp.ibsUf,
              ibs_mun_aliquota: imp.aliquotaIbsMun,
              ibs_mun_valor: imp.ibsMun,
              cbs_aliquota: imp.aliquotaCbs,
              cbs_valor: imp.cbs,
            }
          : {}),
      },
    ],
  };

  return { payload, impostos: imp };
}
