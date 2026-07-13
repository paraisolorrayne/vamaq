import { BUSINESS } from "@/lib/businessInfo";
import { parseValorBR } from "@/lib/money";

// Modelos de contrato fiéis aos PDFs de referência da VAMAQ.
// Cada modelo expõe `build(values)`, que monta o corpo do documento de acordo
// com os dados preenchidos (anuente opcional, favorecido do pagamento,
// alienação fiduciária etc.) e renumera as cláusulas automaticamente.
// O corpo mantém os placeholders {{campo}} — o preenchimento final (datas por
// extenso, campos em branco viram linha) é feito pela rota /api/admin/documents.

const ORDINAIS = [
  "PRIMEIRA",
  "SEGUNDA",
  "TERCEIRA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SÉTIMA",
  "OITAVA",
  "NONA",
  "DÉCIMA",
];

// --- Valor por extenso (pt-BR) ---
const UNIDADES = [
  "", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis",
  "dezessete", "dezoito", "dezenove",
];
const DEZENAS = [
  "", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta",
  "oitenta", "noventa",
];
const CENTENAS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
  "seiscentos", "setecentos", "oitocentos", "novecentos",
];

function trioExtenso(n) {
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const parts = [];
  if (c) parts.push(CENTENAS[c]);
  if (r) {
    if (r < 20) parts.push(UNIDADES[r]);
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      parts.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return parts.join(" e ");
}

export function inteiroPorExtenso(n) {
  n = Math.floor(Math.abs(n));
  if (!n) return "zero";
  const milhoes = Math.floor(n / 1e6);
  const milhares = Math.floor((n % 1e6) / 1000);
  const resto = n % 1000;
  const grupos = [];
  if (milhoes) grupos.push(milhoes === 1 ? "um milhão" : `${trioExtenso(milhoes)} milhões`);
  if (milhares) grupos.push(milhares === 1 ? "mil" : `${trioExtenso(milhares)} mil`);
  if (resto) grupos.push(trioExtenso(resto));
  if (grupos.length === 1) return grupos[0];
  const ultimo = grupos.pop();
  // "e" antes do último grupo quando ele é menor que cem ou centena redonda
  const liga = resto && (resto < 100 || resto % 100 === 0) ? " e " : " ";
  return grupos.join(" ") + liga + ultimo;
}

export function valorPorExtensoBRL(raw) {
  const n = parseValorBR(raw);
  if (!isFinite(n)) return "";
  const inteiro = Math.floor(n);
  const centavos = Math.round((n - inteiro) * 100);
  const parts = [];
  if (inteiro) {
    const de = inteiro >= 1e6 && inteiro % 1e6 === 0 ? " de" : "";
    parts.push(`${inteiroPorExtenso(inteiro)}${de} ${inteiro === 1 ? "real" : "reais"}`);
  }
  if (centavos) {
    parts.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  }
  return parts.join(" e ") || "zero real";
}

function formatBRL(raw) {
  const n = parseValorBR(raw);
  if (!isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// "R$ 158.000,00 (cento e cinquenta e oito mil reais)" — usa o extenso digitado
// pelo usuário quando houver; senão calcula a partir do valor.
function moedaComExtenso(valorKey, extensoKey, values) {
  const fmt = formatBRL(values[valorKey]);
  const extenso = (values[extensoKey] || "").trim() || valorPorExtensoBRL(values[valorKey]);
  const valor = fmt || (values[valorKey] || "").trim();
  if (!valor) return `R$ {{${valorKey}}} ({{${extensoKey}}})`;
  return `R$ ${valor} (${extenso || `{{${extensoKey}}}`})`;
}

function filled(values, key) {
  return Boolean((values[key] || "").trim());
}

function linhaCnh(values, cnhKey, catKey) {
  if (!filled(values, cnhKey)) return null;
  return filled(values, catKey)
    ? `CNH: {{${cnhKey}}} — Categoria {{${catKey}}}`
    : `CNH: {{${cnhKey}}}`;
}

function clausulas(lista) {
  return lista
    .filter(Boolean)
    .map((c, i) => `CLÁUSULA ${ORDINAIS[i]} – ${c.titulo}\n${c.corpo}`)
    .join("\n\n");
}

const COMPRADORA_BLOCO = (papel) => `${papel}:
Razão Social: ${BUSINESS.razaoSocial}
Nome Fantasia: ${BUSINESS.tradeName}
CNPJ: ${BUSINESS.cnpj}
Endereço: ${BUSINESS.address.full}
Representante: ${BUSINESS.representante}`;

const ASSINATURA_VAMAQ = (papel) => `___________________________________________
${BUSINESS.representante}
${BUSINESS.tradeName} · CNPJ: ${BUSINESS.cnpj}
${papel}`;

const TESTEMUNHAS = `TESTEMUNHAS

Nome:
CPF:

Nome:
CPF:`;

// ---------------------------------------------------------------------------
// Contrato de Compra e Venda de Veículo
// ---------------------------------------------------------------------------

function buildCompraVenda(values) {
  const temAnuente = filled(values, "anuente_nome");
  const favorecidoNome = (values.favorecido_nome || "").trim();
  const vendedorNome = (values.vendedor_nome || "").trim();
  const favorecidoEhVendedor =
    !favorecidoNome || favorecidoNome.toLowerCase() === vendedorNome.toLowerCase();

  const vendedor = [
    "VENDEDOR:",
    "Nome: {{vendedor_nome}}",
    "CPF: {{vendedor_cpf}}",
    linhaCnh(values, "vendedor_cnh", "vendedor_cnh_categoria"),
    "Endereço: {{vendedor_endereco}}",
    filled(values, "vendedor_telefone") ? "Telefone: {{vendedor_telefone}}" : null,
    filled(values, "vendedor_email") ? "E-mail: {{vendedor_email}}" : null,
  ]
    .filter(Boolean)
    .join("\n");

  const anuente = temAnuente
    ? [
        "ANUENTE (PROPRIETÁRIO REGISTRAL):",
        "Nome: {{anuente_nome}}",
        "CPF: {{anuente_cpf}}",
        linhaCnh(values, "anuente_cnh", "anuente_cnh_categoria"),
        "Endereço: {{anuente_endereco}}",
        filled(values, "anuente_telefone") ? "Telefone: {{anuente_telefone}}" : null,
      ]
        .filter(Boolean)
        .join("\n")
    : null;

  const veiculo = [
    "Marca: {{veiculo_marca}}",
    "Modelo / Versão: {{veiculo_modelo}}",
    "Ano Fabricação / Modelo: {{veiculo_ano}}",
    "Cor: {{veiculo_cor}}",
    "Placa: {{veiculo_placa}}",
    "Chassi: {{veiculo_chassi}}",
    "RENAVAM: {{veiculo_renavam}}",
    filled(values, "veiculo_km") ? "Hodômetro: {{veiculo_km}} km" : null,
    filled(values, "veiculo_combustivel") ? "Combustível: {{veiculo_combustivel}}" : null,
    "Nº do CRV: {{veiculo_crv}}",
    "Código de Segurança do CRV: {{veiculo_crv_codigo}}",
  ]
    .filter(Boolean)
    .join("\n");

  const valor = moedaComExtenso("valor_total", "valor_extenso", values);

  const pagamentoIntro = favorecidoEhVendedor
    ? `O preço total e certo ajustado para a aquisição do veículo é de ${valor}, a serem pagos pela COMPRADORA à vista, em parcela única, mediante transferência bancária em favor do VENDEDOR, conforme dados abaixo, valendo o respectivo comprovante de transferência como recibo de pagamento e plena, geral e irrevogável quitação:`
    : `O preço total e certo ajustado para a venda do veículo é de ${valor}. Por expressa orientação e autorização do VENDEDOR${temAnuente ? ", com a anuência do PROPRIETÁRIO REGISTRAL" : ""}, o pagamento será realizado integralmente, em parcela única, mediante transferência bancária em favor de ${favorecidoNome.toUpperCase()}, conforme dados abaixo, valendo o respectivo comprovante de transferência como recibo de pagamento e plena quitação:`;

  const pagamentoDados = favorecidoEhVendedor
    ? [
        "DADOS PARA PAGAMENTO — VENDEDOR / FAVORECIDO:",
        "Favorecido: {{vendedor_nome}}",
        "CPF: {{vendedor_cpf}}",
        "Chave PIX: {{favorecido_pix}}",
        "Banco: {{favorecido_banco}}",
        "Agência: {{favorecido_agencia}}",
        "Conta Corrente: {{favorecido_conta}}",
      ].join("\n")
    : [
        "DADOS PARA PAGAMENTO — BENEFICIÁRIO / FAVORECIDO:",
        "Favorecido: {{favorecido_nome}}",
        "CPF: {{favorecido_cpf}}",
        "Chave PIX: {{favorecido_pix}}",
        "Banco: {{favorecido_banco}}",
        "Agência: {{favorecido_agencia}}",
        "Conta Corrente: {{favorecido_conta}}",
      ].join("\n");

  const pagamentoExoneracao = temAnuente
    ? "A COMPRADORA fica exonerada de qualquer responsabilidade quanto a acertos entre o VENDEDOR e o PROPRIETÁRIO REGISTRAL, restando integralmente quitada sua obrigação com o pagamento realizado na forma desta cláusula."
    : "A COMPRADORA resta integralmente quitada e exonerada de qualquer obrigação com o pagamento realizado na forma desta cláusula.";

  const corpo = clausulas([
    {
      titulo: "DO OBJETO",
      corpo: `O VENDEDOR vende à COMPRADORA, em caráter irrevogável e irretratável${temAnuente ? ", com a anuência do PROPRIETÁRIO REGISTRAL" : ""}, o veículo automotor abaixo descrito, livre e desembaraçado de quaisquer ônus não declarados neste instrumento:\n\n${veiculo}`,
    },
    {
      titulo: "DO PREÇO E DA FORMA DE PAGAMENTO",
      corpo: `${pagamentoIntro}\n\n${pagamentoDados}\n\n${pagamentoExoneracao}`,
    },
    temAnuente && {
      titulo: "DA ANUÊNCIA DO PROPRIETÁRIO REGISTRAL",
      corpo: `O veículo objeto deste contrato encontra-se registrado, perante o órgão executivo de trânsito, em nome de ${(values.anuente_nome || "").trim().toUpperCase()}, CPF {{anuente_cpf}}, que comparece e assina este instrumento na qualidade de ANUENTE, declarando expressamente: a) concordar, de forma plena e irrevogável, com a venda do veículo à COMPRADORA; b) autorizar que o pagamento seja efetuado na forma da Cláusula Segunda; c) firmar e entregar a documentação necessária à transferência da propriedade à COMPRADORA ou a quem esta vier a indicar.`,
    },
    {
      titulo: "DA TRANSFERÊNCIA E DA DOCUMENTAÇÃO",
      corpo: `O VENDEDOR ${temAnuente ? "e o ANUENTE obrigam-se" : "obriga-se"} a entregar à COMPRADORA o documento de transferência (ATPV-e / CRV) devidamente preenchido e com firma reconhecida, bem como toda a documentação necessária à regularização da propriedade em nome da COMPRADORA ou de terceiro por ela indicado, no prazo de 5 (cinco) dias úteis contados do pagamento.`,
    },
    {
      titulo: "DOS DÉBITOS E ENCARGOS",
      corpo: `Correm por conta do VENDEDOR ${temAnuente ? "e do PROPRIETÁRIO REGISTRAL " : ""}todos os tributos, multas, taxas e encargos (IPVA, licenciamento, infrações e demais débitos) referentes a fatos geradores ocorridos até a data da entrega do veículo. A partir da tradição, a responsabilidade por tais encargos transfere-se à COMPRADORA.`,
    },
    {
      titulo: "DA ENTREGA E DA POSSE",
      corpo: `A posse do veículo é transferida à COMPRADORA na data de assinatura deste instrumento, declarando esta tê-lo recebido e vistoriado, aceitando-o no estado em que se encontra.`,
    },
    {
      titulo: "DO FORO",
      corpo: `Fica eleito o foro da comarca de ${BUSINESS.address.city} - ${BUSINESS.address.state} para dirimir quaisquer dúvidas oriundas do presente contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.`,
    },
  ]);

  const assinaturaAnuente = temAnuente
    ? `\n\n___________________________________________
{{anuente_nome}}
CPF: {{anuente_cpf}}
ANUENTE · PROPRIETÁRIO REGISTRAL`
    : "";

  return `CONTRATO DE COMPRA E VENDA DE VEÍCULO

Pelo presente instrumento particular de compra e venda, as partes:

${vendedor}

${COMPRADORA_BLOCO("COMPRADORA")}
${anuente ? `\n${anuente}\n` : ""}
${corpo}

${BUSINESS.address.city}, {{data_contrato}}.


___________________________________________
{{vendedor_nome}}
CPF: {{vendedor_cpf}}
VENDEDOR

${ASSINATURA_VAMAQ("COMPRADORA")}${assinaturaAnuente}

${TESTEMUNHAS}`;
}

// ---------------------------------------------------------------------------
// Contrato de Consignação de Veículo
// ---------------------------------------------------------------------------

function buildConsignacao(values) {
  const temAnuente = filled(values, "anuente_nome");
  const temAlienacao = /^sim$/i.test((values.alienacao_fiduciaria || "").trim());

  const consignante = [
    "CONSIGNANTE:",
    "Nome: {{proprietario_nome}}",
    "CPF: {{proprietario_cpf}}",
    linhaCnh(values, "proprietario_cnh", "proprietario_cnh_categoria"),
    "Endereço: {{proprietario_endereco}}",
    filled(values, "proprietario_telefone") ? "Telefone: {{proprietario_telefone}}" : null,
  ]
    .filter(Boolean)
    .join("\n");

  const anuente = temAnuente
    ? [
        "ANUENTE (PROPRIETÁRIO REGISTRAL):",
        "Nome: {{anuente_nome}}",
        "CPF: {{anuente_cpf}}",
        "Endereço: {{anuente_endereco}}",
      ].join("\n")
    : null;

  const veiculo = [
    "Marca: {{veiculo_marca}}",
    "Modelo / Versão: {{veiculo_modelo}}",
    "Ano Fabricação / Modelo: {{veiculo_ano}}",
    "Cor: {{veiculo_cor}}",
    "Placa: {{veiculo_placa}}",
    "Chassi: {{veiculo_chassi}}",
    "RENAVAM: {{veiculo_renavam}}",
    "Quilometragem: {{veiculo_km}} km",
    "Combustível: {{veiculo_combustivel}}",
    "Espécie / Tipo: {{veiculo_especie}}",
    "Carroceria: {{veiculo_carroceria}}",
    filled(values, "veiculo_observacoes") || temAlienacao
      ? `Observações: ${filled(values, "veiculo_observacoes") ? "{{veiculo_observacoes}}" : "Veículo com alienação fiduciária"}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const valor = moedaComExtenso("valor_liquido", "valor_liquido_extenso", values);

  const prazoDias = (values.prazo_dias || "").trim();
  const prazoExtenso =
    (values.prazo_extenso || "").trim() ||
    (/^\d+$/.test(prazoDias) ? inteiroPorExtenso(parseInt(prazoDias, 10)) : "");
  const prazo = prazoDias
    ? `${prazoDias} (${prazoExtenso || "{{prazo_extenso}}"}) dias corridos`
    : `{{prazo_dias}} ({{prazo_extenso}}) dias corridos`;

  // Retirada antecipada: entra no contrato quando carência OU taxa forem
  // preenchidas (campo faltante vira linha em branco, como no resto do
  // gerador). Com os dois em branco, a rescisão mantém a redação sem ônus.
  const carenciaDias = (values.retirada_carencia_dias || "").trim();
  const temTaxaRetirada = Boolean(carenciaDias) || filled(values, "retirada_taxa");
  const carenciaExtenso = /^\d+$/.test(carenciaDias)
    ? inteiroPorExtenso(parseInt(carenciaDias, 10))
    : "";
  const carencia = !carenciaDias
    ? "{{retirada_carencia_dias}} dias corridos"
    : carenciaExtenso
      ? `${carenciaDias} (${carenciaExtenso}) dias corridos`
      : `${carenciaDias} dias corridos`;
  const taxaRetirada = filled(values, "retirada_taxa")
    ? moedaComExtenso("retirada_taxa", "retirada_taxa_extenso", values)
    : "R$ {{retirada_taxa}}";

  const corpo = clausulas([
    {
      titulo: "DO OBJETO",
      corpo: `O CONSIGNANTE entrega à CONSIGNATÁRIA, em regime de consignação${temAnuente ? ", com a expressa anuência do PROPRIETÁRIO REGISTRAL" : ""}, o seguinte veículo:\n\n${veiculo}`,
    },
    {
      titulo: "DO VALOR E DA REMUNERAÇÃO",
      corpo: `O valor líquido a ser pago ao CONSIGNANTE pela venda do veículo é de ${valor}. A CONSIGNATÁRIA fica autorizada a anunciar e comercializar o veículo por valor superior, constituindo a diferença entre o valor de venda efetivamente recebido e o valor líquido pago ao CONSIGNANTE a remuneração da CONSIGNATÁRIA. Eventuais negociações que impliquem valor inferior ao líquido aqui pactuado dependerão de prévia anuência do CONSIGNANTE.`,
    },
    temAnuente && {
      titulo: "DA ANUÊNCIA DO PROPRIETÁRIO REGISTRAL",
      corpo: `O veículo objeto deste contrato encontra-se registrado, perante o órgão executivo de trânsito, em nome de ${(values.anuente_nome || "").trim().toUpperCase()}, CPF {{anuente_cpf}}, que comparece e assina este instrumento na qualidade de ANUENTE, declarando expressamente: a) concordar, de forma plena e irrevogável, com a entrega do veículo em consignação e com a sua venda pela CONSIGNATÁRIA; b) firmar e entregar a documentação necessária à transferência da propriedade ao futuro comprador indicado pela CONSIGNATÁRIA.`,
    },
    temAlienacao && {
      titulo: "DA ALIENAÇÃO FIDUCIÁRIA",
      corpo: `As partes declaram ter ciência de que o veículo consta gravado com alienação fiduciária perante o órgão executivo de trânsito. O CONSIGNANTE ${temAnuente ? "e o ANUENTE obrigam-se" : "obriga-se"} a promover a quitação do financiamento e a baixa do gravame, ou a obter a anuência formal da instituição financeira credora, em tempo hábil para a efetivação da venda e a regular transferência do veículo ao comprador, respondendo por eventuais perdas e danos decorrentes do descumprimento desta obrigação.`,
    },
    {
      titulo: "DO PRAZO",
      corpo: `O presente contrato tem prazo de ${prazo}, contados a partir da data de assinatura, podendo ser renovado mediante acordo mútuo entre as partes.`,
    },
    {
      titulo: "DAS OBRIGAÇÕES DA CONSIGNATÁRIA",
      corpo: `a) Manter o veículo em local seguro e adequado; b) Não utilizar o veículo para fins diversos da exposição e test-drive supervisionado; c) Comunicar imediatamente ao CONSIGNANTE qualquer avaria, sinistro ou ocorrência envolvendo o veículo; d) Efetuar o pagamento ao CONSIGNANTE em até 5 (cinco) dias úteis após a confirmação do recebimento integral do valor de venda; e) Devolver o veículo nas mesmas condições recebidas em caso de não venda dentro do prazo contratual.`,
    },
    {
      titulo: "DAS OBRIGAÇÕES DO CONSIGNANTE",
      corpo: `a) Entregar o veículo em perfeito estado de conservação e funcionamento; b) Manter a documentação do veículo regularizada, incluindo IPVA, licenciamento e eventuais débitos até a data de entrega; c) Não vender, doar ou alienar o veículo a terceiros durante a vigência deste contrato; d) Arcar com tributos, multas e demais encargos referentes a fatos geradores anteriores à entrega do veículo.`,
    },
    {
      titulo: "DA RESCISÃO",
      corpo: temTaxaRetirada
        ? `O CONSIGNANTE poderá retirar o veículo a qualquer momento, mediante aviso prévio de 48 (quarenta e oito) horas, ressalvada eventual venda já concretizada. Caso a retirada ocorra antes de decorridos ${carencia} da assinatura deste instrumento, o CONSIGNANTE pagará à CONSIGNATÁRIA, no ato da retirada, a importância de ${taxaRetirada}, a título de ressarcimento das despesas incorridas com a preparação e divulgação do veículo, tais como produção de material fotográfico e audiovisual, anúncios e tráfego pago, nada mais sendo devido entre as partes a esse título. Decorrida a carência, a retirada não gerará ônus para qualquer das partes.`
        : `O CONSIGNANTE poderá retirar o veículo a qualquer momento, mediante aviso prévio de 48 (quarenta e oito) horas, sem ônus para qualquer das partes, ressalvada eventual venda já concretizada.`,
    },
    {
      titulo: "DO FORO",
      corpo: `Fica eleito o foro da comarca de ${BUSINESS.address.city} - ${BUSINESS.address.state} para dirimir quaisquer dúvidas oriundas do presente contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.`,
    },
  ]);

  const assinaturaAnuente = temAnuente
    ? `\n\n___________________________________________
{{anuente_nome}}
CPF: {{anuente_cpf}}
ANUENTE · PROPRIETÁRIO REGISTRAL`
    : "";

  return `CONTRATO DE CONSIGNAÇÃO DE VEÍCULO

Pelo presente instrumento particular de consignação, as partes:

${consignante}

${COMPRADORA_BLOCO("CONSIGNATÁRIA")}
${anuente ? `\n${anuente}\n` : ""}
Celebram o presente contrato de consignação, mediante as seguintes cláusulas:

${corpo}

${BUSINESS.address.city}, {{data_contrato}}.


___________________________________________
{{proprietario_nome}}
CPF: {{proprietario_cpf}}
CONSIGNANTE

${ASSINATURA_VAMAQ("CONSIGNATÁRIA")}${assinaturaAnuente}

${TESTEMUNHAS}`;
}

// ---------------------------------------------------------------------------
// Definição dos modelos (campos agrupados por seção, na ordem dos documentos
// que o executor terá em mãos: CNH do vendedor/consignante + CRLV do veículo)
// ---------------------------------------------------------------------------

export const DEFAULT_TEMPLATES = [
  {
    id: "compra-venda",
    name: "Contrato de Compra e Venda de Veículo",
    description:
      "Compra de veículo pela Vamaq, com anuência opcional do proprietário registral e dados de pagamento",
    build: buildCompraVenda,
    fields: [
      { key: "vendedor_nome", label: "Nome do Vendedor", type: "text", section: "Vendedor (dados da CNH)" },
      { key: "vendedor_cpf", label: "CPF do Vendedor", type: "text", section: "Vendedor (dados da CNH)" },
      { key: "vendedor_cnh", label: "Nº de Registro da CNH", type: "text", section: "Vendedor (dados da CNH)" },
      { key: "vendedor_cnh_categoria", label: "Categoria da CNH", type: "text", section: "Vendedor (dados da CNH)" },
      { key: "vendedor_endereco", label: "Endereço do Vendedor", type: "text", section: "Vendedor (dados da CNH)" },
      { key: "vendedor_telefone", label: "Telefone do Vendedor", type: "text", section: "Vendedor (dados da CNH)" },
      { key: "vendedor_email", label: "E-mail do Vendedor", type: "text", section: "Vendedor (dados da CNH)" },
      {
        key: "anuente_nome",
        label: "Nome do Anuente",
        type: "text",
        section: "Anuente — proprietário registral (dados do CRLV)",
        hint: "Preencha somente se o veículo estiver registrado em nome de outra pessoa (campo NOME do CRLV). Em branco, o contrato sai sem anuente.",
      },
      { key: "anuente_cpf", label: "CPF do Anuente", type: "text", section: "Anuente — proprietário registral (dados do CRLV)" },
      { key: "anuente_cnh", label: "Nº de Registro da CNH do Anuente", type: "text", section: "Anuente — proprietário registral (dados do CRLV)" },
      { key: "anuente_cnh_categoria", label: "Categoria da CNH do Anuente", type: "text", section: "Anuente — proprietário registral (dados do CRLV)" },
      { key: "anuente_endereco", label: "Endereço do Anuente", type: "text", section: "Anuente — proprietário registral (dados do CRLV)" },
      { key: "anuente_telefone", label: "Telefone do Anuente", type: "text", section: "Anuente — proprietário registral (dados do CRLV)" },
      { key: "veiculo_marca", label: "Marca", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_modelo", label: "Modelo / Versão", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_ano", label: "Ano Fabricação / Modelo", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_cor", label: "Cor", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_placa", label: "Placa", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_chassi", label: "Chassi", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_renavam", label: "RENAVAM", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_km", label: "Hodômetro (km)", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_combustivel", label: "Combustível", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_crv", label: "Nº do CRV", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_crv_codigo", label: "Código de Segurança do CRV", type: "text", section: "Veículo (dados do CRLV)" },
      {
        key: "valor_total",
        label: "Valor Total (R$)",
        type: "text",
        section: "Pagamento",
        hint: "Ex.: 158.000,00 — o valor por extenso é gerado automaticamente se o campo abaixo ficar vazio.",
      },
      { key: "valor_extenso", label: "Valor por Extenso (opcional)", type: "text", section: "Pagamento" },
      {
        key: "favorecido_nome",
        label: "Favorecido do Pagamento",
        type: "text",
        section: "Pagamento",
        hint: "Em branco, o pagamento sai em favor do próprio vendedor. Preencha para pagar a terceiro (ex.: o proprietário registral).",
      },
      { key: "favorecido_cpf", label: "CPF do Favorecido", type: "text", section: "Pagamento" },
      { key: "favorecido_pix", label: "Chave PIX", type: "text", section: "Pagamento" },
      { key: "favorecido_banco", label: "Banco", type: "text", section: "Pagamento" },
      { key: "favorecido_agencia", label: "Agência", type: "text", section: "Pagamento" },
      { key: "favorecido_conta", label: "Conta Corrente", type: "text", section: "Pagamento" },
      { key: "data_contrato", label: "Data do Contrato", type: "date", section: "Contrato" },
    ],
  },
  {
    id: "consignacao",
    name: "Contrato de Consignação de Veículo",
    description:
      "Consignação na loja, com anuência opcional do proprietário registral e cláusula de alienação fiduciária",
    build: buildConsignacao,
    fields: [
      { key: "proprietario_nome", label: "Nome do Consignante", type: "text", section: "Consignante (dados da CNH)" },
      { key: "proprietario_cpf", label: "CPF do Consignante", type: "text", section: "Consignante (dados da CNH)" },
      { key: "proprietario_cnh", label: "Nº de Registro da CNH", type: "text", section: "Consignante (dados da CNH)" },
      { key: "proprietario_cnh_categoria", label: "Categoria da CNH", type: "text", section: "Consignante (dados da CNH)" },
      { key: "proprietario_endereco", label: "Endereço do Consignante", type: "text", section: "Consignante (dados da CNH)" },
      { key: "proprietario_telefone", label: "Telefone do Consignante", type: "text", section: "Consignante (dados da CNH)" },
      {
        key: "anuente_nome",
        label: "Nome do Anuente",
        type: "text",
        section: "Anuente — proprietário registral (dados do CRLV)",
        hint: "Preencha somente se o veículo estiver registrado em nome de outra pessoa (campo NOME do CRLV). Em branco, o contrato sai sem anuente.",
      },
      { key: "anuente_cpf", label: "CPF do Anuente", type: "text", section: "Anuente — proprietário registral (dados do CRLV)" },
      { key: "anuente_endereco", label: "Endereço do Anuente", type: "text", section: "Anuente — proprietário registral (dados do CRLV)" },
      { key: "veiculo_marca", label: "Marca", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_modelo", label: "Modelo / Versão", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_ano", label: "Ano Fabricação / Modelo", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_cor", label: "Cor", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_placa", label: "Placa", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_chassi", label: "Chassi", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_renavam", label: "RENAVAM", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_km", label: "Quilometragem (km)", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_combustivel", label: "Combustível", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_especie", label: "Espécie / Tipo", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_carroceria", label: "Carroceria", type: "text", section: "Veículo (dados do CRLV)" },
      {
        key: "veiculo_observacoes",
        label: "Observações",
        type: "text",
        section: "Veículo (dados do CRLV)",
        hint: "Campo OBSERVAÇÕES DO VEÍCULO do CRLV (ex.: alienação fiduciária).",
      },
      {
        key: "alienacao_fiduciaria",
        label: "Veículo com alienação fiduciária?",
        type: "select",
        options: ["Não", "Sim"],
        section: "Condições",
        hint: "Consta no campo OBSERVAÇÕES do CRLV. Marcando Sim, o contrato inclui a cláusula de quitação/baixa do gravame.",
      },
      {
        key: "valor_liquido",
        label: "Valor Líquido ao Consignante (R$)",
        type: "text",
        section: "Condições",
        hint: "Ex.: 165.000,00 — o valor por extenso é gerado automaticamente se o campo abaixo ficar vazio.",
      },
      { key: "valor_liquido_extenso", label: "Valor Líquido por Extenso (opcional)", type: "text", section: "Condições" },
      {
        key: "prazo_dias",
        label: "Prazo de Consignação (dias)",
        type: "text",
        section: "Condições",
        hint: "Ex.: 120 — o prazo por extenso é gerado automaticamente se o campo abaixo ficar vazio.",
      },
      { key: "prazo_extenso", label: "Prazo por Extenso (opcional)", type: "text", section: "Condições" },
      {
        key: "retirada_carencia_dias",
        label: "Carência para Retirada sem Taxa (dias)",
        type: "text",
        section: "Condições",
        hint: "Ex.: 30 — se o consignante retirar o veículo antes desse prazo, paga a taxa abaixo. Preenchendo carência ou taxa, a cláusula entra no contrato (campo vazio vira linha em branco). Com os dois em branco, a retirada sai sem ônus.",
      },
      {
        key: "retirada_taxa",
        label: "Taxa de Retirada Antecipada (R$)",
        type: "text",
        section: "Condições",
        hint: "Ex.: 800,00 — ressarce custos de preparação e divulgação (material do veículo, anúncios, tráfego pago). O valor por extenso é gerado automaticamente.",
      },
      { key: "data_contrato", label: "Data do Contrato", type: "date", section: "Condições" },
    ],
  },
];
