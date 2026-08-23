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


/**
 * Tamanho máximo de cada campo de texto da NF-e 4.00, com o nome que a
 * operadora reconhece na tela.
 *
 * POR QUE ISTO EXISTE (22/08/2026): a Mayra emitiu uma consignação e a SEFAZ
 * recusou com "natOp: The value has a length of '69'; this exceeds the allowed
 * maximum length of '60'". O texto tinha 69 caracteres porque eu copiei a
 * descrição oficial do CFOP para um campo que aceita 60.
 *
 * Um limite estourado é a coisa mais fácil de conferir ANTES de mandar, e a
 * mais opaca de entender depois: a recusa vem em inglês, citando a tag do XML
 * (`natOp`, `xNome`, `xLgr`), que ninguém que opera a loja sabe o que é. Aqui
 * o erro sai nomeando o campo da tela e dizendo quanto sobra.
 */
const LIMITES = [
  ["natureza_operacao", 60, "a natureza da operação"],
  ["nome_destinatario", 60, "o nome"],
  ["logradouro_destinatario", 60, "o logradouro"],
  ["numero_destinatario", 60, "o número do endereço"],
  ["bairro_destinatario", 60, "o bairro"],
  ["municipio_destinatario", 60, "o município"],
  ["informacoes_adicionais_contribuinte", 5000, "o texto de informações complementares"],
];

const LIMITES_ITEM = [
  ["descricao", 120, "a descrição do veículo"],
  ["codigo_produto", 60, "o código do produto"],
];

/**
 * Confere os limites e devolve a primeira violação, em português.
 *
 * Uma por vez de propósito: listar cinco problemas de uma vez faz a operadora
 * ler o primeiro e ignorar o resto. Corrigiu, roda de novo, vê o próximo.
 */
function validaLimites(payload) {
  const checa = (valor, limite, rotulo) => {
    const texto = String(valor ?? "");
    if (texto.length <= limite) return null;
    return {
      error: `${rotulo.charAt(0).toUpperCase()}${rotulo.slice(1)} tem ${texto.length} caracteres e a nota fiscal aceita no máximo ${limite}. Encurte em ${texto.length - limite}.`,
    };
  };

  for (const [campo, limite, rotulo] of LIMITES) {
    const erro = checa(payload[campo], limite, rotulo);
    if (erro) return erro;
  }
  for (const item of payload.items || []) {
    for (const [campo, limite, rotulo] of LIMITES_ITEM) {
      const erro = checa(item[campo], limite, rotulo);
      if (erro) return erro;
    }
  }
  for (const fp of payload.formas_pagamento || []) {
    const erro = checa(fp.descricao_pagamento, 60, "a descrição da forma de pagamento");
    if (erro) return erro;
  }
  return null;
}

/**
 * A descrição do item na nota. Igual na entrada e na saída de propósito: é o
 * mesmo carro, e a SEFAZ liga uma à outra pelo chassi.
 */
function descricaoVeiculo(veiculo) {
  return [
    `${veiculo.brand} ${veiculo.model} ${veiculo.year}`,
    veiculo.placa ? `Placa ${veiculo.placa}` : null,
    `Chassi ${veiculo.chassi}`,
  ]
    .filter(Boolean)
    .join(" - ");
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

  const descricao = descricaoVeiculo(veiculo);

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
    // A natureza acompanha o CFOP: nota com 6102 dizendo "Venda Dentro do
    // Estado" se contradiz na própria cara da DANFE.
    natureza_operacao: interestadual
      ? String(config.natureza_interestadual || "Venda Fora do Estado")
      : String(config.natureza_operacao || "Venda Dentro do Estado"),
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

  const excedeu = validaLimites(payload);
  if (excedeu) return excedeu;

  return { payload, impostos: imp };
}

/**
 * Monta a NF-e de ENTRADA (modelo 55, tpNF = 0) — a nota que a Vamaq emite ao
 * COMPRAR um veículo de pessoa física.
 *
 * POR QUE ELA IMPORTA: o texto obrigatório da nota de VENDA cita o número da
 * nota de ENTRADA do veículo. Sem a entrada, a venda não sai. É a ordem que a
 * própria NF 12 impõe.
 *
 * SÓ PESSOA FÍSICA. Comprando de PJ quem emite é a PJ — ela é contribuinte e
 * emite a própria nota de venda; a Vamaq recebe e escritura. Emitir aqui
 * também poria duas notas na mesma compra, com o carro entrando duas vezes no
 * estoque fiscal.
 *
 * SEM IMPOSTO A DESTACAR: CST 041 (não tributada), ICMS, PIS e COFINS zerados
 * — é o que as notas 14 e 15 da Vamaq, autorizadas pela SEFAZ-MG, registram.
 * Quem vendeu é pessoa física e não destaca imposto nenhum.
 *
 * `remetente` é quem VENDEU o carro para a Vamaq. Ele vai nos campos de
 * destinatário do layout: numa nota de entrada é o `tipo_documento: 0` que diz
 * que a mercadoria entra no estabelecimento de quem emite, e a contraparte
 * continua ocupando o grupo do destinatário.
 */
export function montarPayloadEntrada({
  config,
  veiculo,
  remetente,
  valorAquisicao,
  consignacao = false,
}) {
  const fora = deOutroEstado(config, remetente);
  return montarPayloadSemImposto({
    config,
    veiculo,
    contraparte: remetente,
    valor: valorAquisicao,
    saida: false,
    interestadual: fora,
    papel: "Quem vendeu o veículo",
    rotuloValor: "valor pago pelo veículo",
    cfop: consignacao
      ? fora
        ? String(config.cfop_entrada_consignacao_interestadual || "2917")
        : String(config.cfop_entrada_consignacao || "1917")
      : fora
        ? String(config.cfop_entrada_interestadual || "2102")
        : String(config.cfop_entrada || "1102"),
    natureza: consignacao
      ? String(
          config.natureza_entrada_consignacao ||
            "Entrada de mercadoria em consignacao mercantil"
        )
      : fora
        ? String(config.natureza_entrada_interestadual || "Compra Fora do Estado")
        : String(config.natureza_entrada || "Compra Dentro do Estado"),
  });
}

/**
 * A outra parte está em outro estado?
 *
 * Na ENTRADA e na DEVOLUÇÃO isto basta — a mercadoria atravessou a divisa, e é
 * a origem dela que define a operação. Diferente da VENDA, onde o contador
 * ressalvou que comprador de outro estado que vem à loja e leva o carro fez
 * operação interna (o fato gerador foi em MG).
 */
function deOutroEstado(config, contraparte) {
  const emitente = String(config.uf || "MG").trim().toUpperCase();
  const outra = String(contraparte?.uf ?? "").trim().toUpperCase();
  return Boolean(outra) && outra !== emitente;
}

/**
 * Devolução de veículo recebido em CONSIGNAÇÃO — o carro que não vendeu e
 * volta para o dono. CFOP 5918, resposta do contador em 14/08/2026.
 *
 * É uma SAÍDA (tpNF 1) sem imposto: o carro nunca foi comprado, então não há
 * nada a tributar na volta — espelha a entrada 1917 que o trouxe.
 *
 * `consignante` é quem deixou o carro. Vem gravado na nota de entrada, então a
 * tela não precisa pedir o endereço de novo: redigitar oito campos para
 * devolver um carro é a receita para o endereço sair diferente do que entrou.
 */
export function montarPayloadDevolucaoConsignacao({ config, veiculo, consignante, valor }) {
  return montarPayloadSemImposto({
    config,
    veiculo,
    contraparte: consignante,
    valor,
    saida: true,
    interestadual: deOutroEstado(config, consignante),
    papel: "O dono do carro",
    rotuloValor: "valor pelo qual o carro foi recebido",
    cfop: deOutroEstado(config, consignante)
      ? String(config.cfop_devolucao_consignacao_interestadual || "6918")
      : String(config.cfop_devolucao_consignacao || "5918"),
    natureza: String(
      config.natureza_devolucao_consignacao ||
        "Devolucao de mercadoria em consignacao mercantil"
    ),
  });
}

/**
 * O corpo comum das notas SEM imposto destacado: entrada de compra de pessoa
 * física, entrada de consignação e devolução de consignação.
 *
 * As três têm a mesma natureza fiscal — CST 041, ICMS/PIS/COFINS zerados,
 * contraparte pessoa física sem IE — e diferem só no CFOP, na natureza da
 * operação e no sentido (`tipo_documento`). Duplicar o corpo para cada uma
 * seria três lugares para corrigir quando a SEFAZ recusar um campo.
 */
function montarPayloadSemImposto({
  config,
  veiculo,
  contraparte,
  valor,
  saida,
  cfop,
  natureza,
  papel,
  rotuloValor,
  interestadual = false,
}) {
  const total = Number(valor) || 0;
  // A mensagem nomeia o valor e a pessoa. Generalizar para "a outra parte" e
  // "o valor" economizaria duas linhas aqui e custaria clareza na tela de quem
  // está preenchendo — o operador não sabe o que é "a outra parte".
  if (total <= 0) return { error: `Informe o ${rotuloValor}.` };

  for (const [campo, rotulo] of [
    ["cnpj", "CNPJ do emitente"],
    ["ncm", "NCM"],
    ["serie", "série"],
  ]) {
    if (!config?.[campo]) {
      return { error: `Parâmetro fiscal ausente: ${rotulo}. Peça ao contador.` };
    }
  }
  if (!veiculo?.chassi) return { error: "O veículo está sem chassi. Preencha no cadastro." };
  for (const [campo, rotulo] of CAMPOS_DESTINATARIO) {
    if (!contraparte?.[campo]) return { error: `${papel} está sem ${rotulo}.` };
  }

  const doc = so_digitos(contraparte.doc);
  if (doc.length !== 11) {
    return {
      error:
        "A nota de entrada é só para compra de pessoa física (CPF). Comprando de empresa, quem emite a nota é ela — a Vamaq só recebe e escritura.",
    };
  }

  const cstNormalizado = normalizaCstIcms(config.cst_entrada || "041", config.origem);
  if (cstNormalizado.error) return { error: cstNormalizado.error };

  const descricao = descricaoVeiculo(veiculo);

  const payload = {
      natureza_operacao: natureza,
      data_emissao: new Date().toISOString(),
      // 0 = entrada (a mercadoria entra no estabelecimento de quem emite),
      // 1 = saída. É só isto que separa receber o carro de devolvê-lo.
      tipo_documento: saida ? 1 : 0,
      finalidade_emissao: 1,
      // idDest: 1 = operação interna, 2 = interestadual. Acompanha o CFOP.
      local_destino: interestadual ? 2 : 1,
      serie: String(config.serie),
      cnpj_emitente: so_digitos(config.cnpj),

      // Na entrada o frete continua 1 (confirmado em 18/08/2026), diferente da
      // saída, que o contador corrigiu para 9 em 14/08.
      modalidade_frete: String(config.modalidade_frete_entrada ?? "1"),
      presenca_comprador: "1",
      consumidor_final: "1",
      // Pessoa física não tem inscrição estadual.
      indicador_inscricao_estadual_destinatario: 9,

      nome_destinatario: contraparte.nome,
      cpf_destinatario: doc,
      cep_destinatario: so_digitos(contraparte.cep),
      logradouro_destinatario: contraparte.logradouro,
      numero_destinatario: String(contraparte.numero),
      bairro_destinatario: contraparte.bairro,
      municipio_destinatario: contraparte.municipio,
      uf_destinatario: String(contraparte.uf).toUpperCase(),
      valor_total: total,

      formas_pagamento: [
        {
          indicador_pagamento: String(config.indicador_pagamento ?? "1"),
          forma_pagamento: String(config.forma_pagamento || "99"),
          ...(String(config.forma_pagamento || "99") === "99"
            ? { descricao_pagamento: String(config.descricao_pagamento || "A prazo") }
            : {}),
          valor_pagamento: total,
        },
      ],

      items: [
        {
          numero_item: 1,
          codigo_produto: veiculo.placa || veiculo.chassi,
          descricao,
          codigo_ncm: String(config.ncm),
          cfop,
          unidade_comercial: "UN",
          quantidade_comercial: 1,
          valor_unitario_comercial: total,
          valor_bruto: total,

          // CST 41 = não tributada. Tudo zerado — é o que as notas 14 e 15
          // autorizadas registram.
          icms_situacao_tributaria: cstNormalizado.cst,
          icms_base_calculo: 0,
          icms_aliquota: 0,
          icms_valor: 0,
          ...(config.origem ? { icms_origem: String(config.origem) } : {}),

          pis_situacao_tributaria: String(config.pis_situacao_tributaria_entrada || "07"),
          pis_base_calculo: 0,
          pis_aliquota_porcentual: 0,
          pis_valor: 0,

          cofins_situacao_tributaria: String(config.cofins_situacao_tributaria_entrada || "07"),
          cofins_base_calculo: 0,
          cofins_aliquota_porcentual: 0,
          cofins_valor: 0,
        },
      ],
  };

  const excedeu = validaLimites(payload);
  if (excedeu) return excedeu;

  return { payload };
}
