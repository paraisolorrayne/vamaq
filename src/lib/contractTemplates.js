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
  "DÉCIMA PRIMEIRA",
  "DÉCIMA SEGUNDA",
  "DÉCIMA TERCEIRA",
  "DÉCIMA QUARTA",
  "DÉCIMA QUINTA",
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

// "R$ 70.000,00 (setenta mil reais)" com extenso sempre calculado — para
// valores sem campo de extenso próprio (troca, volta).
function moedaAuto(raw) {
  const fmt = formatBRL(raw);
  if (!fmt) return `R$ ${(raw || "").trim()}`;
  const extenso = valorPorExtensoBRL(raw);
  return extenso ? `R$ ${fmt} (${extenso})` : `R$ ${fmt}`;
}

// Aceita "60", "60 dias", "60 dias corridos" — usa o primeiro número digitado;
// sem número nenhum, mantém o texto como veio.
function prazoEmDias(raw) {
  const t = (raw || "").trim();
  const m = t.match(/\d+/);
  return m ? m[0] : t;
}

// Cláusula livre digitada pelo usuário — entra antes do foro, quando preenchida.
function clausulaPersonalizada(values) {
  if (!filled(values, "clausulas_personalizadas")) return null;
  return {
    titulo: "DISPOSIÇÕES ESPECIAIS",
    corpo: values.clausulas_personalizadas.trim(),
  };
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

// Bloco de identificação da Vamaq com o papel dela em cada contrato:
// COMPRADORA (compra e venda), VENDEDORA (venda), CONSIGNATÁRIA (consignação).
const VAMAQ_BLOCO = (papel) => `${papel}:
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
// Checklist de pendências documentais e itens de entrega do veículo
// ---------------------------------------------------------------------------
// Declaração do vendedor/consignante no ato da entrega, comum aos dois
// contratos. A PRIMEIRA opção de cada campo é sempre "A verificar": campo
// intocado no formulário nunca declara falsamente que não há multa ou que um
// item foi entregue — obriga o operador a confirmar cada linha.

const ENTREGA_OPTS = ["A verificar", "Entregue", "Não entregue", "Não possui"];

const CHECKLIST_ITENS = [
  {
    titulo: "SITUAÇÃO DOCUMENTAL E DE DÉBITOS",
    itens: [
      ["item_multas", "Multas ou autuações em aberto", ["A verificar", "Nada consta", "Consta pendência (ver observações)"]],
      ["item_ipva", "IPVA", ["A verificar", "Quitado", "Em aberto", "Parcelado"]],
      ["item_licenciamento", "Licenciamento", ["A verificar", "Em dia", "Vencido"]],
      ["item_recall", "Recall pendente", ["A verificar", "Nada consta", "Consta pendência (ver observações)"]],
    ],
  },
  {
    titulo: "ITENS E ACESSÓRIOS ENTREGUES",
    itens: [
      ["item_manual", "Manual do proprietário", ENTREGA_OPTS],
      ["item_chave_reserva", "Chave reserva (2ª chave)", ENTREGA_OPTS],
      ["item_chave_roda", "Chave de roda e macaco", ENTREGA_OPTS],
      ["item_estepe", "Estepe / pneu reserva", ENTREGA_OPTS],
      ["item_triangulo", "Triângulo de sinalização", ENTREGA_OPTS],
    ],
  },
];

// Campos de formulário do checklist — idênticos nos dois contratos.
const CHECKLIST_ITENS_FIELDS = [
  ...CHECKLIST_ITENS.flatMap((g) =>
    g.itens.map(([key, label, options]) => ({
      key,
      label,
      type: "select",
      options,
      section: "Pendências e itens do veículo (checklist de entrega)",
    }))
  ),
  {
    key: "item_observacoes",
    label: "Observações sobre pendências e itens",
    type: "textarea",
    section: "Pendências e itens do veículo (checklist de entrega)",
    hint: "Detalhe multas/autuações, recall ou itens faltantes. Preencha sempre que marcar \"Consta pendência\", \"Em aberto\", \"Vencido\" ou \"Não entregue\".",
  },
];

// Corpo do quadro: cabeçalhos de grupo (viram rótulo de seção no PDF) +
// linhas "Rótulo: {{campo}}" (viram bloco chave-valor, como a ficha do veículo).
function blocoChecklistItens() {
  return CHECKLIST_ITENS.map(
    (g) =>
      `${g.titulo}\n\n` +
      g.itens.map(([key, rotulo]) => `${rotulo}: {{${key}}}`).join("\n")
  ).join("\n\n");
}

// Cláusula do checklist de entrega. `entregador`/`recebedor` são os papéis do
// contrato JÁ COM artigo/preposição ("O VENDEDOR", "à COMPRADORA"), para
// acomodar gênero dos papéis; `responsabilidade` é a frase de fecho que amarra
// os débitos em aberto à cláusula correspondente de cada contrato. Entra
// sempre — os campos têm default "A verificar", então o quadro nunca fica em
// branco. `plural` ajusta a redação quando mais de um veículo entra na
// negociação (o quadro é único; distinções entre veículos vão nas observações).
function clausulaItensPendencias(values, { entregador, recebedor, responsabilidade, plural = false }) {
  const obs = filled(values, "item_observacoes")
    ? "\n\nOBSERVAÇÕES\n\n{{item_observacoes}}"
    : "";
  const notaPlural = plural
    ? "\n\nAs declarações do quadro acima aplicam-se a todos os veículos objeto deste contrato; qualquer distinção entre eles deverá constar das observações."
    : "";
  return {
    titulo: `DO ESTADO DOCUMENTAL E DOS ITENS ${plural ? "DOS VEÍCULOS" : "DO VEÍCULO"}`,
    corpo: `${entregador} declara ${recebedor}, para todos os fins, a situação documental e de débitos ${plural ? "dos veículos" : "do veículo"} e relaciona os itens e acessórios entregues nesta data, conforme o quadro abaixo:\n\n${blocoChecklistItens()}${obs}${notaPlural}\n\n${responsabilidade}`,
  };
}

// ---------------------------------------------------------------------------
// Contrato de Compra e Venda de Veículo
// ---------------------------------------------------------------------------

// Ficha do veículo comprado. `prefix` permite descrever mais de um veículo
// no mesmo contrato (veiculo, veiculo2, veiculo3). O valor atribuído sai na
// ficha para discriminar o valor de cada um quando a negociação tem vários.
function blocoVeiculoCompra(values, prefix) {
  return [
    `Marca: {{${prefix}_marca}}`,
    `Modelo / Versão: {{${prefix}_modelo}}`,
    `Ano Fabricação / Modelo: {{${prefix}_ano}}`,
    `Cor: {{${prefix}_cor}}`,
    `Placa: {{${prefix}_placa}}`,
    `Chassi: {{${prefix}_chassi}}`,
    `RENAVAM: {{${prefix}_renavam}}`,
    filled(values, `${prefix}_km`) ? `Hodômetro: {{${prefix}_km}} km` : null,
    filled(values, `${prefix}_combustivel`) ? `Combustível: {{${prefix}_combustivel}}` : null,
    `Nº do CRV: {{${prefix}_crv}}`,
    `Código de Segurança do CRV: {{${prefix}_crv_codigo}}`,
    filled(values, `${prefix}_valor`)
      ? `Valor atribuído: R$ ${formatBRL(values[`${prefix}_valor`]) || values[`${prefix}_valor`].trim()}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

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

  // Veículos objeto da compra: o principal + até dois adicionais, que entram
  // quando marca, placa ou chassi forem preenchidos ("um ou mais carros na
  // negociação").
  const prefixos = ["veiculo", "veiculo2", "veiculo3"].filter(
    (p, i) =>
      i === 0 ||
      filled(values, `${p}_marca`) ||
      filled(values, `${p}_placa`) ||
      filled(values, `${p}_chassi`)
  );
  const plural = prefixos.length > 1;
  const doVeiculo = plural ? "dos veículos" : "do veículo";

  const listaVeiculos = plural
    ? prefixos
        .map((p, i) => `VEÍCULO ${i + 1}\n${blocoVeiculoCompra(values, p)}`)
        .join("\n\n")
    : blocoVeiculoCompra(values, "veiculo");

  const valor = moedaComExtenso("valor_total", "valor_extenso", values);

  // Troca: veículo dado pela COMPRADORA como parte (ou totalidade) do
  // pagamento, com volta em dinheiro para qualquer um dos lados.
  const temTroca = ["troca_marca", "troca_placa", "troca_chassi", "troca_valor"].some((k) =>
    filled(values, k)
  );
  const temVolta = filled(values, "troca_volta");
  const vendedorPagaVolta = /^vendedor/i.test((values.troca_volta_direcao || "").trim());
  const trocaValor = filled(values, "troca_valor")
    ? moedaAuto(values.troca_valor)
    : "R$ {{troca_valor}}";
  const voltaValor = temVolta ? moedaAuto(values.troca_volta) : "R$ {{troca_volta}}";
  const trocaVeiculo = [
    "VEÍCULO DADO NA TROCA PELA COMPRADORA",
    "Marca: {{troca_marca}}",
    "Modelo / Versão: {{troca_modelo}}",
    "Ano Fabricação / Modelo: {{troca_ano}}",
    "Cor: {{troca_cor}}",
    "Placa: {{troca_placa}}",
    "Chassi: {{troca_chassi}}",
    "RENAVAM: {{troca_renavam}}",
  ].join("\n");

  const pagamentoIntro = favorecidoEhVendedor
    ? `O preço total e certo ajustado para a aquisição ${doVeiculo} é de ${valor}, a serem pagos pela COMPRADORA à vista, em parcela única, mediante transferência bancária em favor do VENDEDOR, conforme dados abaixo, valendo o respectivo comprovante de transferência como recibo de pagamento e plena, geral e irrevogável quitação:`
    : `O preço total e certo ajustado para a venda ${doVeiculo} é de ${valor}. Por expressa orientação e autorização do VENDEDOR${temAnuente ? ", com a anuência do PROPRIETÁRIO REGISTRAL" : ""}, o pagamento será realizado integralmente, em parcela única, mediante transferência bancária em favor de ${favorecidoNome.toUpperCase()}, conforme dados abaixo, valendo o respectivo comprovante de transferência como recibo de pagamento e plena quitação:`;

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

  // Quatro formas de pagamento: só dinheiro (redação original); troca que
  // quita o preço; troca + volta paga pela COMPRADORA (caso típico); e troca
  // em que o VENDEDOR paga a volta (veículo da troca vale mais que o preço).
  const favorecidoVolta = favorecidoEhVendedor
    ? "do VENDEDOR"
    : `de ${favorecidoNome.toUpperCase()}, por expressa orientação e autorização do VENDEDOR${temAnuente ? ", com a anuência do PROPRIETÁRIO REGISTRAL" : ""}`;
  const exoneracaoAnuente = temAnuente
    ? " A COMPRADORA fica exonerada de qualquer responsabilidade quanto a acertos entre o VENDEDOR e o PROPRIETÁRIO REGISTRAL, restando integralmente quitada sua obrigação com o cumprimento desta cláusula."
    : "";

  let pagamentoCorpo;
  if (!temTroca) {
    pagamentoCorpo = `${pagamentoIntro}\n\n${pagamentoDados}\n\n${pagamentoExoneracao}`;
  } else if (!temVolta) {
    pagamentoCorpo = `O preço total e certo ajustado para a aquisição ${doVeiculo} é de ${valor}, integralmente pago pela COMPRADORA mediante a entrega ao VENDEDOR, em dação em pagamento (troca), do veículo abaixo descrito, aceito pelas partes pelo valor, atribuído de comum acordo, de ${trocaValor}, correspondente à totalidade do preço:\n\n${trocaVeiculo}\n\nCom a entrega do veículo dado na troca, o VENDEDOR dá à COMPRADORA plena, geral e irrevogável quitação do preço.${exoneracaoAnuente}`;
  } else if (vendedorPagaVolta) {
    pagamentoCorpo = `O preço total e certo ajustado para a aquisição ${doVeiculo} é de ${valor}, pago pela COMPRADORA mediante a entrega ao VENDEDOR, em dação em pagamento (troca), do veículo abaixo descrito, aceito pelas partes pelo valor, atribuído de comum acordo, de ${trocaValor}:\n\n${trocaVeiculo}\n\nComo o valor atribuído ao veículo dado na troca supera o preço ajustado, o VENDEDOR pagará à COMPRADORA, no ato da assinatura deste instrumento, a diferença em dinheiro (volta) de ${voltaValor}, à vista, em parcela única, valendo o respectivo comprovante como recibo. Cumpridas essas obrigações, as partes dão-se mutuamente plena, geral e irrevogável quitação quanto ao preço.${exoneracaoAnuente}`;
  } else {
    pagamentoCorpo = `O preço total e certo ajustado para a aquisição ${doVeiculo} é de ${valor}, pago pela COMPRADORA da seguinte forma:\n\na) Mediante a entrega ao VENDEDOR, a título de parte do pagamento (dação em pagamento / troca), do veículo abaixo descrito, aceito pelas partes pelo valor, atribuído de comum acordo, de ${trocaValor}:\n\n${trocaVeiculo}\n\nb) Mediante o pagamento da diferença em dinheiro (volta), no valor de ${voltaValor}, à vista, em parcela única, por transferência bancária em favor ${favorecidoVolta}, conforme dados abaixo, valendo o respectivo comprovante de transferência como recibo de pagamento:\n\n${pagamentoDados}\n\nCumpridas as obrigações das alíneas "a" e "b", o VENDEDOR dá à COMPRADORA plena, geral e irrevogável quitação do preço.${exoneracaoAnuente}`;
  }

  const corpo = clausulas([
    {
      titulo: "DO OBJETO",
      corpo: `O VENDEDOR vende à COMPRADORA, em caráter irrevogável e irretratável${temAnuente ? ", com a anuência do PROPRIETÁRIO REGISTRAL" : ""}, ${plural ? `os ${prefixos.length} (${inteiroPorExtenso(prefixos.length)}) veículos automotores abaixo descritos, livres e desembaraçados` : "o veículo automotor abaixo descrito, livre e desembaraçado"} de quaisquer ônus não declarados neste instrumento:\n\n${listaVeiculos}`,
    },
    {
      titulo: "DO PREÇO E DA FORMA DE PAGAMENTO",
      corpo: pagamentoCorpo,
    },
    temAnuente && {
      titulo: "DA ANUÊNCIA DO PROPRIETÁRIO REGISTRAL",
      corpo: `${plural ? "Os veículos objeto deste contrato, ou parte deles, encontram-se registrados" : "O veículo objeto deste contrato encontra-se registrado"}, perante o órgão executivo de trânsito, em nome de ${(values.anuente_nome || "").trim().toUpperCase()}, CPF {{anuente_cpf}}, que comparece e assina este instrumento na qualidade de ANUENTE, declarando expressamente: a) concordar, de forma plena e irrevogável, com a venda ${doVeiculo} à COMPRADORA; b) autorizar que o pagamento seja efetuado na forma da Cláusula Segunda; c) firmar e entregar a documentação necessária à transferência da propriedade à COMPRADORA ou a quem esta vier a indicar.`,
    },
    temTroca && {
      titulo: "DO VEÍCULO DADO NA TROCA",
      corpo: `A COMPRADORA declara que o veículo por ela dado na troca encontra-se livre e desembaraçado de quaisquer ônus não declarados neste instrumento, obrigando-se a entregar ao VENDEDOR o respectivo documento de transferência (ATPV-e / CRV) devidamente preenchido e com firma reconhecida, bem como a documentação necessária à regularização da propriedade em nome do VENDEDOR ou de terceiro por ele indicado, no prazo de 5 (cinco) dias úteis contados da assinatura deste instrumento. Os tributos, multas, taxas e encargos incidentes sobre o veículo dado na troca, referentes a fatos geradores ocorridos até a data da sua entrega, correm por conta da COMPRADORA. O VENDEDOR declara ter vistoriado o veículo recebido na troca, aceitando-o no estado em que se encontra.`,
    },
    {
      titulo: "DA TRANSFERÊNCIA E DA DOCUMENTAÇÃO",
      corpo: `O VENDEDOR ${temAnuente ? "e o ANUENTE obrigam-se" : "obriga-se"} a entregar à COMPRADORA ${plural ? "os documentos de transferência (ATPV-e / CRV) de cada um dos veículos, devidamente preenchidos e com firma reconhecida" : "o documento de transferência (ATPV-e / CRV) devidamente preenchido e com firma reconhecida"}, bem como toda a documentação necessária à regularização da propriedade em nome da COMPRADORA ou de terceiro por ela indicado, no prazo de 5 (cinco) dias úteis contados do pagamento.`,
    },
    {
      titulo: "DOS DÉBITOS E ENCARGOS",
      corpo: `Correm por conta do VENDEDOR ${temAnuente ? "e do PROPRIETÁRIO REGISTRAL " : ""}todos os tributos, multas, taxas e encargos (IPVA, licenciamento, infrações e demais débitos) referentes a fatos geradores ocorridos até a data da entrega ${plural ? "de cada veículo" : "do veículo"}. A partir da tradição, a responsabilidade por tais encargos transfere-se à COMPRADORA.`,
    },
    clausulaItensPendencias(values, {
      entregador: "O VENDEDOR",
      recebedor: "à COMPRADORA",
      plural,
      responsabilidade: `Os tributos, multas e infrações declarados como em aberto, com fato gerador anterior à entrega, correm por conta do VENDEDOR, na forma da cláusula DOS DÉBITOS E ENCARGOS, e a COMPRADORA confirma o recebimento dos itens assinalados como "Entregue".`,
    }),
    {
      titulo: "DA ENTREGA E DA POSSE",
      corpo: plural
        ? `A posse dos veículos é transferida à COMPRADORA na data de assinatura deste instrumento, declarando esta tê-los recebido e vistoriado, aceitando-os no estado em que se encontram.`
        : `A posse do veículo é transferida à COMPRADORA na data de assinatura deste instrumento, declarando esta tê-lo recebido e vistoriado, aceitando-o no estado em que se encontra.`,
    },
    clausulaPersonalizada(values),
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

  return `CONTRATO DE COMPRA DE VEÍCULO

Pelo presente instrumento particular de compra e venda, as partes:

${vendedor}

${VAMAQ_BLOCO("COMPRADORA")}
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
// Contrato de Venda de Veículo (Vamaq vende ao cliente)
// ---------------------------------------------------------------------------
// Direção inversa da compra e venda: a Vamaq é a VENDEDORA do veículo (que
// sai do estoque) e o COMPRADOR pode pagar com um ou mais veículos dados na
// troca — inclusive registrados em nome de terceiros — mais volta (paga pela
// Vamaq) ou saldo (pago pelo comprador).

// Ficha de veículo recebido na troca: a ficha padrão + proprietário registral
// quando o CRLV está em nome de terceiro (pessoa ou empresa). A linha do
// proprietário fica separada da ficha por linha em branco de propósito: no
// PDF ela vira um cartão próprio com quebra de linha, em vez de ser truncada
// numa célula da grade do veículo.
function blocoVeiculoTroca(values, prefix) {
  const dono = filled(values, `${prefix}_proprietario`)
    ? `\n\nProprietário registral: {{${prefix}_proprietario}}${filled(values, `${prefix}_proprietario_doc`) ? ` — CPF/CNPJ {{${prefix}_proprietario_doc}}` : ""}`
    : "";
  return blocoVeiculoCompra(values, prefix) + dono;
}

function buildVenda(values) {
  const temAnuente = filled(values, "anuente_nome");
  const temRepresentante = filled(values, "comprador_representante_nome");

  const comprador = [
    "COMPRADOR:",
    "Nome / Razão Social: {{comprador_nome}}",
    "CPF / CNPJ: {{comprador_cpf}}",
    linhaCnh(values, "comprador_cnh", "comprador_cnh_categoria"),
    temRepresentante
      ? `Representante legal: {{comprador_representante_nome}}${filled(values, "comprador_representante_cpf") ? " — CPF {{comprador_representante_cpf}}" : ""}`
      : null,
    "Endereço: {{comprador_endereco}}",
    filled(values, "comprador_telefone") ? "Telefone: {{comprador_telefone}}" : null,
    filled(values, "comprador_email") ? "E-mail: {{comprador_email}}" : null,
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

  // Veículos recebidos na troca (dados pelo comprador): até três, presentes
  // quando marca, placa ou chassi forem preenchidos.
  const trocas = ["troca", "troca2", "troca3"].filter(
    (p) =>
      filled(values, `${p}_marca`) ||
      filled(values, `${p}_placa`) ||
      filled(values, `${p}_chassi`)
  );
  const temTroca = trocas.length > 0;
  const pluralTroca = trocas.length > 1;
  const listaTroca = trocas
    .map(
      (p, i) =>
        `${pluralTroca ? `VEÍCULO ${i + 1} RECEBIDO NA TROCA` : "VEÍCULO RECEBIDO NA TROCA"}\n${blocoVeiculoTroca(values, p)}`
    )
    .join("\n\n");
  const entregaTroca = pluralTroca
    ? `dos ${trocas.length} (${inteiroPorExtenso(trocas.length)}) veículos abaixo descritos, aceitos pelas partes pelos valores atribuídos de comum acordo indicados em suas fichas`
    : "do veículo abaixo descrito, aceito pelas partes pelo valor atribuído de comum acordo indicado em sua ficha";

  const valor = moedaComExtenso("valor_total", "valor_extenso", values);
  const temDiferenca = filled(values, "venda_diferenca");
  const compradorPagaSaldo = /^comprador/i.test((values.venda_diferenca_direcao || "").trim());
  const diferencaValor = temDiferenca ? moedaAuto(values.venda_diferenca) : "R$ {{venda_diferenca}}";

  // Volta paga a terceiro indicado pelo comprador (ex.: empresa dele).
  const temFavorecidoVolta = filled(values, "volta_favorecido_nome");
  const blocoFavorecidoVolta = [
    "DADOS PARA PAGAMENTO DA VOLTA — FAVORECIDO:",
    "Favorecido: {{volta_favorecido_nome}}",
    "CPF / CNPJ: {{volta_favorecido_doc}}",
    filled(values, "volta_favorecido_pix") ? "Chave PIX: {{volta_favorecido_pix}}" : null,
    filled(values, "volta_favorecido_banco") ? "Banco: {{volta_favorecido_banco}}" : null,
    filled(values, "volta_favorecido_agencia") ? "Agência: {{volta_favorecido_agencia}}" : null,
    filled(values, "volta_favorecido_conta") ? "Conta: {{volta_favorecido_conta}}" : null,
  ]
    .filter(Boolean)
    .join("\n");

  let pagamentoCorpo;
  if (!temTroca) {
    pagamentoCorpo = `O preço total e certo ajustado para a venda do veículo é de ${valor}, pago pelo COMPRADOR à vista, em parcela única, na data de assinatura deste instrumento, mediante transferência bancária ou PIX em favor da VENDEDORA, valendo o respectivo comprovante como recibo de pagamento e plena, geral e irrevogável quitação.`;
  } else if (!temDiferenca) {
    pagamentoCorpo = `O preço total e certo ajustado para a venda do veículo é de ${valor}, integralmente pago pelo COMPRADOR mediante a entrega à VENDEDORA, em dação em pagamento (troca), ${entregaTroca}, cuja soma corresponde à totalidade do preço:\n\n${listaTroca}\n\nCom a entrega ${pluralTroca ? "dos veículos dados" : "do veículo dado"} na troca, as partes dão-se mutuamente plena, geral e irrevogável quitação quanto ao preço.`;
  } else if (compradorPagaSaldo) {
    pagamentoCorpo = `O preço total e certo ajustado para a venda do veículo é de ${valor}, pago pelo COMPRADOR da seguinte forma:\n\na) Mediante a entrega à VENDEDORA, a título de parte do pagamento (dação em pagamento / troca), ${entregaTroca}:\n\n${listaTroca}\n\nb) Mediante o pagamento do saldo em dinheiro, no valor de ${diferencaValor}, à vista, em parcela única, na data de assinatura deste instrumento, mediante transferência bancária ou PIX em favor da VENDEDORA, valendo o respectivo comprovante como recibo de pagamento.\n\nCumpridas as obrigações das alíneas "a" e "b", a VENDEDORA dá ao COMPRADOR plena, geral e irrevogável quitação do preço.`;
  } else {
    const destinoVolta = temFavorecidoVolta
      ? `, por expressa orientação e autorização do COMPRADOR, em favor de ${(values.volta_favorecido_nome || "").trim().toUpperCase()}, conforme dados abaixo, valendo o respectivo comprovante como recibo:\n\n${blocoFavorecidoVolta}`
      : ` em favor do COMPRADOR, valendo o respectivo comprovante como recibo.`;
    const recebimentoTroca = pluralTroca
      ? `os ${trocas.length} (${inteiroPorExtenso(trocas.length)}) veículos abaixo descritos, entregues pelo COMPRADOR e aceitos pelas partes pelos valores atribuídos de comum acordo indicados em suas fichas`
      : "o veículo abaixo descrito, entregue pelo COMPRADOR e aceito pelas partes pelo valor atribuído de comum acordo indicado em sua ficha";
    const somaSupera = pluralTroca
      ? "Como a soma dos valores atribuídos aos veículos recebidos na troca supera"
      : "Como o valor atribuído ao veículo recebido na troca supera";
    pagamentoCorpo = `O preço total e certo ajustado para a venda do veículo é de ${valor}, recebendo a VENDEDORA, em dação em pagamento (troca), ${recebimentoTroca}:\n\n${listaTroca}\n\n${somaSupera} o preço do veículo vendido, a VENDEDORA pagará ao COMPRADOR a diferença em dinheiro (volta), no valor de ${diferencaValor}, à vista, em parcela única, mediante transferência bancária ou PIX${destinoVolta}\n\nCumpridas essas obrigações, as partes dão-se mutuamente plena, geral e irrevogável quitação quanto ao preço.`;
  }

  const corpo = clausulas([
    {
      titulo: "DO OBJETO",
      corpo: `A VENDEDORA vende ao COMPRADOR, em caráter irrevogável e irretratável${temAnuente ? ", com a anuência do PROPRIETÁRIO REGISTRAL" : ""}, o veículo automotor abaixo descrito, livre e desembaraçado de quaisquer ônus não declarados neste instrumento:\n\n${blocoVeiculoCompra(values, "veiculo")}`,
    },
    {
      titulo: "DO PREÇO E DA FORMA DE PAGAMENTO",
      corpo: pagamentoCorpo,
    },
    temAnuente && {
      titulo: "DA ANUÊNCIA DO PROPRIETÁRIO REGISTRAL",
      corpo: `O veículo objeto deste contrato encontra-se registrado, perante o órgão executivo de trânsito, em nome de ${(values.anuente_nome || "").trim().toUpperCase()}, CPF/CNPJ {{anuente_cpf}}, que comparece e assina este instrumento na qualidade de ANUENTE, declarando expressamente: a) concordar, de forma plena e irrevogável, com a venda do veículo ao COMPRADOR; b) autorizar que o preço seja recebido integralmente pela VENDEDORA, realizando com esta, em separado, os acertos que lhe couberem; c) firmar e entregar a documentação necessária à transferência da propriedade ao COMPRADOR ou a quem este vier a indicar.`,
    },
    temTroca && {
      titulo: `${pluralTroca ? "DOS VEÍCULOS RECEBIDOS" : "DO VEÍCULO RECEBIDO"} NA TROCA`,
      corpo: `O COMPRADOR declara que ${pluralTroca ? "os veículos dados na troca encontram-se livres e desembaraçados" : "o veículo dado na troca encontra-se livre e desembaraçado"} de quaisquer ônus não declarados neste instrumento, respondendo pela evicção. Obriga-se o COMPRADOR a entregar à VENDEDORA ${pluralTroca ? "os documentos de transferência (ATPV-e / CRV) de cada veículo dado na troca, devidamente preenchidos e com firma reconhecida" : "o documento de transferência (ATPV-e / CRV) do veículo dado na troca, devidamente preenchido e com firma reconhecida"} — inclusive quanto a veículo registrado em nome de terceiro, cuja documentação e anuência o COMPRADOR se obriga a providenciar —, em nome da VENDEDORA ou de terceiro por ela indicado, no prazo de 5 (cinco) dias úteis contados da assinatura deste instrumento. Os tributos, multas, taxas e encargos incidentes sobre ${pluralTroca ? "os veículos dados" : "o veículo dado"} na troca, referentes a fatos geradores ocorridos até a data da entrega, correm por conta do COMPRADOR. A VENDEDORA declara ter vistoriado ${pluralTroca ? "os veículos recebidos, aceitando-os no estado em que se encontram" : "o veículo recebido, aceitando-o no estado em que se encontra"}.`,
    },
    {
      titulo: "DA TRANSFERÊNCIA E DA DOCUMENTAÇÃO",
      corpo: `A VENDEDORA ${temAnuente ? "e o ANUENTE obrigam-se" : "obriga-se"} a entregar ao COMPRADOR o documento de transferência (ATPV-e / CRV) devidamente preenchido e com firma reconhecida, bem como toda a documentação necessária à regularização da propriedade em nome do COMPRADOR ou de terceiro por ele indicado, no prazo de 5 (cinco) dias úteis contados do pagamento integral do preço.`,
    },
    {
      titulo: "DOS DÉBITOS E ENCARGOS",
      corpo: `Correm por conta da VENDEDORA ${temAnuente ? "e do PROPRIETÁRIO REGISTRAL " : ""}todos os tributos, multas, taxas e encargos (IPVA, licenciamento, infrações e demais débitos) referentes a fatos geradores ocorridos até a data da entrega do veículo vendido. A partir da tradição, a responsabilidade por tais encargos transfere-se ao COMPRADOR.`,
    },
    clausulaItensPendencias(values, {
      entregador: "A VENDEDORA",
      recebedor: "ao COMPRADOR",
      responsabilidade: `Os tributos, multas e infrações declarados como em aberto, com fato gerador anterior à entrega, correm por conta da VENDEDORA, na forma da cláusula DOS DÉBITOS E ENCARGOS, e o COMPRADOR confirma o recebimento dos itens assinalados como "Entregue".`,
    }),
    {
      titulo: "DA ENTREGA, DA POSSE E DA GARANTIA",
      corpo: `A posse do veículo vendido é transferida ao COMPRADOR na data de assinatura deste instrumento, declarando este tê-lo recebido e vistoriado, aceitando-o, na condição de veículo usado, no estado em que se encontra, sem prejuízo da garantia legal prevista no Código de Defesa do Consumidor.`,
    },
    clausulaPersonalizada(values),
    {
      titulo: "DO FORO",
      corpo: `Fica eleito o foro da comarca de ${BUSINESS.address.city} - ${BUSINESS.address.state} para dirimir quaisquer dúvidas oriundas do presente contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.`,
    },
  ]);

  const assinaturaComprador = temRepresentante
    ? `___________________________________________
{{comprador_representante_nome}}
{{comprador_nome}} · CPF/CNPJ: {{comprador_cpf}}
COMPRADOR`
    : `___________________________________________
{{comprador_nome}}
CPF/CNPJ: {{comprador_cpf}}
COMPRADOR`;

  const assinaturaAnuente = temAnuente
    ? `\n\n___________________________________________
{{anuente_nome}}
CPF/CNPJ: {{anuente_cpf}}
ANUENTE · PROPRIETÁRIO REGISTRAL`
    : "";

  return `CONTRATO DE VENDA DE VEÍCULO

Pelo presente instrumento particular de compra e venda, as partes:

${VAMAQ_BLOCO("VENDEDORA")}

${comprador}
${anuente ? `\n${anuente}\n` : ""}
${corpo}

${BUSINESS.address.city}, {{data_contrato}}.


${ASSINATURA_VAMAQ("VENDEDORA")}

${assinaturaComprador}${assinaturaAnuente}

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

  const prazoDias = prazoEmDias(values.prazo_dias);
  const prazoExtenso =
    (values.prazo_extenso || "").trim() ||
    (/^\d+$/.test(prazoDias) ? inteiroPorExtenso(parseInt(prazoDias, 10)) : "");
  const prazo = prazoDias
    ? `${prazoDias} (${prazoExtenso || "{{prazo_extenso}}"}) dias corridos`
    : `{{prazo_dias}} ({{prazo_extenso}}) dias corridos`;

  // Retirada antecipada: entra no contrato quando carência OU taxa forem
  // preenchidas (campo faltante vira linha em branco, como no resto do
  // gerador). Com os dois em branco, a rescisão mantém a redação sem ônus.
  const carenciaDias = prazoEmDias(values.retirada_carencia_dias);
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
      titulo: "DA GUARDA E DA RESPONSABILIDADE PELO VEÍCULO",
      corpo: `Enquanto o veículo permanecer sob sua posse, a CONSIGNATÁRIA responde, na qualidade de depositária, pela sua guarda e conservação, obrigando-se a indenizar o CONSIGNANTE, no valor líquido previsto na cláusula DO VALOR E DA REMUNERAÇÃO, em caso de perda total decorrente de furto, roubo, incêndio ou colisão ocorridos nesse período, e a arcar com os reparos necessários em caso de dano parcial. A responsabilidade da CONSIGNATÁRIA não alcança: a) o desgaste natural do veículo e de seus componentes; b) as avarias preexistentes à entrega, em especial as registradas em termo de vistoria firmado entre as partes, quando houver; c) danos decorrentes de vício oculto ou defeito intrínseco do veículo não informado pelo CONSIGNANTE. A responsabilidade da CONSIGNATÁRIA cessa com a devolução do veículo ao CONSIGNANTE ou com a sua entrega ao comprador.`,
    },
    {
      titulo: "DAS MULTAS E INFRAÇÕES",
      corpo: `As infrações de trânsito cometidas no período em que o veículo estiver sob a posse da CONSIGNATÁRIA, bem como os danos causados a terceiros nesse período, são de responsabilidade exclusiva da CONSIGNATÁRIA, que se obriga a promover a indicação do condutor infrator na forma da legislação de trânsito e a reembolsar o CONSIGNANTE de qualquer valor que este venha a desembolsar em razão de tais fatos. As multas, os tributos e os demais débitos com fato gerador anterior à entrega do veículo à CONSIGNATÁRIA permanecem de responsabilidade do CONSIGNANTE.`,
    },
    clausulaItensPendencias(values, {
      entregador: "O CONSIGNANTE",
      recebedor: "à CONSIGNATÁRIA",
      responsabilidade: `Os tributos, multas e infrações declarados como em aberto, com fato gerador anterior à entrega, permanecem de responsabilidade do CONSIGNANTE, na forma das cláusulas DAS OBRIGAÇÕES DO CONSIGNANTE e DAS MULTAS E INFRAÇÕES, e os itens assinalados como "Entregue" deverão ser restituídos com o veículo em caso de devolução.`,
    }),
    {
      titulo: "DA RESCISÃO",
      corpo: temTaxaRetirada
        ? `O CONSIGNANTE poderá retirar o veículo a qualquer momento, mediante aviso prévio de 48 (quarenta e oito) horas, ressalvada eventual venda já concretizada. Caso a retirada ocorra antes de decorridos ${carencia} da assinatura deste instrumento, o CONSIGNANTE pagará à CONSIGNATÁRIA, no ato da retirada, a importância de ${taxaRetirada}, a título de ressarcimento das despesas incorridas com a preparação e divulgação do veículo, tais como produção de material fotográfico e audiovisual, anúncios e tráfego pago, nada mais sendo devido entre as partes a esse título. Decorrida a carência, a retirada não gerará ônus para qualquer das partes.`
        : `O CONSIGNANTE poderá retirar o veículo a qualquer momento, mediante aviso prévio de 48 (quarenta e oito) horas, sem ônus para qualquer das partes, ressalvada eventual venda já concretizada.`,
    },
    clausulaPersonalizada(values),
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

${VAMAQ_BLOCO("CONSIGNATÁRIA")}
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
// Termo de Vistoria e Recebimento de Veículo em Consignação
// ---------------------------------------------------------------------------

const CHECKLIST_VISTORIA = [
  ["estado_lataria", "Lataria"],
  ["estado_pintura", "Pintura"],
  ["estado_vidros", "Vidros"],
  ["estado_retrovisores", "Retrovisores"],
  ["estado_iluminacao", "Iluminação"],
  ["estado_pneus", "Pneus"],
  ["estado_interior", "Interior"],
  ["estado_painel", "Painel"],
  ["estado_motor", "Motor e câmbio"],
];

function buildTermoVistoria(values) {
  const consignante = [
    "CONSIGNANTE:",
    "Nome: {{proprietario_nome}}",
    "CPF: {{proprietario_cpf}}",
    filled(values, "proprietario_telefone") ? "Telefone: {{proprietario_telefone}}" : null,
  ]
    .filter(Boolean)
    .join("\n");

  const veiculo = [
    "Marca: {{veiculo_marca}}",
    "Modelo / Versão: {{veiculo_modelo}}",
    "Ano Fabricação / Modelo: {{veiculo_ano}}",
    "Cor: {{veiculo_cor}}",
    "Placa: {{veiculo_placa}}",
    "Chassi: {{veiculo_chassi}}",
    "RENAVAM: {{veiculo_renavam}}",
    "Hodômetro: {{veiculo_km}} km",
    filled(values, "veiculo_combustivel") ? "Combustível: {{veiculo_combustivel}}" : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Quilometragem por escrito (número + extenso), como pede o termo.
  const kmDigits = (values.veiculo_km || "").replace(/\D/g, "");
  const kmLinha = kmDigits
    ? `Na data desta vistoria, o hodômetro do veículo registra ${values.veiculo_km.trim()} (${inteiroPorExtenso(parseInt(kmDigits, 10))}) quilômetros, quilometragem conferida e confirmada por ambas as partes.`
    : `Na data desta vistoria, o hodômetro do veículo registra {{veiculo_km}} quilômetros, quilometragem conferida e confirmada por ambas as partes.`;

  const checklist = CHECKLIST_VISTORIA.map(([key, rotulo]) => `${rotulo}: {{${key}}}`).join("\n");

  const temFotos = /^sim$/i.test((values.registro_fotografico || "").trim());
  const fotos = temFotos
    ? `A vistoria foi acompanhada de registro fotográfico composto por ${filled(values, "fotos_quantidade") ? "{{fotos_quantidade}}" : "_____"} fotografias, que refletem o estado do veículo na data da entrega e integram o presente termo como ANEXO I.`
    : `As partes declaram dispensado o registro fotográfico da vistoria, prevalecendo, quanto ao estado do veículo, as descrições constantes deste termo.`;

  const avarias = filled(values, "avarias_observacoes")
    ? "{{avarias_observacoes}}"
    : "Nenhuma avaria apontada pelas partes na data da vistoria.";

  return `TERMO DE VISTORIA DE VEÍCULO EM CONSIGNAÇÃO

Pelo presente termo, as partes abaixo identificadas formalizam a vistoria de entrega do veículo em consignação, que passa a integrar o contrato de consignação firmado entre elas:

${consignante}

${VAMAQ_BLOCO("CONSIGNATÁRIA")}

${veiculo}

DA QUILOMETRAGEM

${kmLinha}

DO ESTADO DE CONSERVAÇÃO CONSTATADO NA VISTORIA

${checklist}

AVARIAS E OBSERVAÇÕES

${avarias}

DO REGISTRO FOTOGRÁFICO

${fotos}

DAS DECLARAÇÕES FINAIS

As partes declaram que as informações acima refletem fielmente o estado do veículo no ato da entrega à CONSIGNATÁRIA. Este termo servirá de referência para a devolução do veículo e para a apuração de eventuais avarias supervenientes, na forma da cláusula de guarda e responsabilidade do contrato de consignação. E, por estarem de acordo, firmam o presente termo em 2 (duas) vias de igual teor.

${BUSINESS.address.city}, {{data_contrato}}.


___________________________________________
{{proprietario_nome}}
CPF: {{proprietario_cpf}}
CONSIGNANTE

${ASSINATURA_VAMAQ("CONSIGNATÁRIA")}`;
}

// ---------------------------------------------------------------------------
// Definição dos modelos (campos agrupados por seção, na ordem dos documentos
// que o executor terá em mãos: CNH do vendedor/consignante + CRLV do veículo)
// ---------------------------------------------------------------------------

// Campos de um veículo comprado (compra e venda). `hintMarca` vai no primeiro
// campo da seção para explicar quando preenchê-la (veículos adicionais).
function veiculoCompraFields(prefix, section, hintMarca) {
  return [
    { key: `${prefix}_marca`, label: "Marca", type: "text", section, ...(hintMarca ? { hint: hintMarca } : {}) },
    { key: `${prefix}_modelo`, label: "Modelo / Versão", type: "text", section },
    { key: `${prefix}_ano`, label: "Ano Fabricação / Modelo", type: "text", section },
    { key: `${prefix}_cor`, label: "Cor", type: "text", section },
    { key: `${prefix}_placa`, label: "Placa", type: "text", section },
    { key: `${prefix}_chassi`, label: "Chassi", type: "text", section },
    { key: `${prefix}_renavam`, label: "RENAVAM", type: "text", section },
    { key: `${prefix}_km`, label: "Hodômetro (km)", type: "text", section },
    { key: `${prefix}_combustivel`, label: "Combustível", type: "text", section },
    { key: `${prefix}_crv`, label: "Nº do CRV", type: "text", section },
    { key: `${prefix}_crv_codigo`, label: "Código de Segurança do CRV", type: "text", section },
    {
      key: `${prefix}_valor`,
      label: "Valor deste veículo (R$)",
      type: "text",
      section,
      hint: "Opcional — sai na ficha do veículo, para discriminar o valor de cada um quando mais de um entra na negociação.",
    },
  ];
}

const SECAO_TROCA = "Troca — veículo dado pela Vamaq como pagamento (opcional)";

// Campos de um veículo recebido na troca (contrato de venda): ficha completa
// + valor atribuído + proprietário registral quando o CRLV é de terceiro.
function veiculoTrocaFields(prefix, section, hintMarca) {
  return [
    { key: `${prefix}_marca`, label: "Marca", type: "text", section, ...(hintMarca ? { hint: hintMarca } : {}) },
    { key: `${prefix}_modelo`, label: "Modelo / Versão", type: "text", section },
    { key: `${prefix}_ano`, label: "Ano Fabricação / Modelo", type: "text", section },
    { key: `${prefix}_cor`, label: "Cor", type: "text", section },
    { key: `${prefix}_placa`, label: "Placa", type: "text", section },
    { key: `${prefix}_chassi`, label: "Chassi", type: "text", section },
    { key: `${prefix}_renavam`, label: "RENAVAM", type: "text", section },
    { key: `${prefix}_km`, label: "Hodômetro (km)", type: "text", section },
    { key: `${prefix}_combustivel`, label: "Combustível", type: "text", section },
    { key: `${prefix}_crv`, label: "Nº do CRV", type: "text", section },
    { key: `${prefix}_crv_codigo`, label: "Código de Segurança do CRV", type: "text", section },
    {
      key: `${prefix}_valor`,
      label: "Valor atribuído (R$)",
      type: "text",
      section,
      hint: "Valor pelo qual o veículo entra na negociação. Ex.: 165.000,00 — sai na ficha do veículo.",
    },
    {
      key: `${prefix}_proprietario`,
      label: "Proprietário registral (se terceiro)",
      type: "text",
      section,
      hint: "Preencha se o CRLV estiver em nome de outra pessoa ou empresa (campo NOME do CRLV). O comprador se obriga a providenciar a documentação e a anuência desse terceiro.",
    },
    { key: `${prefix}_proprietario_doc`, label: "CPF/CNPJ do proprietário registral", type: "text", section },
  ];
}

const SECAO_DIFERENCA = "Diferença em dinheiro (volta ou saldo)";

export const DEFAULT_TEMPLATES = [
  {
    id: "compra-venda",
    name: "Contrato de Compra de Veículo",
    description:
      "A VAMAQ COMPRA um ou mais veículos do cliente — com troca (veículo do estoque dado como pagamento + volta), anuência opcional do proprietário registral e dados de pagamento",
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
      ...veiculoCompraFields("veiculo", "Veículo 1 (dados do CRLV)"),
      ...veiculoCompraFields(
        "veiculo2",
        "Veículo 2 (opcional — dados do CRLV)",
        "Preencha somente se mais de um veículo entrar na negociação (a Vamaq comprando dois carros de uma vez). Em branco, o contrato sai com um só veículo."
      ),
      ...veiculoCompraFields(
        "veiculo3",
        "Veículo 3 (opcional — dados do CRLV)",
        "Preencha somente se houver um terceiro veículo na negociação."
      ),
      ...CHECKLIST_ITENS_FIELDS,
      {
        key: "troca_marca",
        label: "Marca",
        type: "text",
        section: SECAO_TROCA,
        hint: "Preencha quando a Vamaq der um veículo dela como parte do pagamento (troca). Em branco, o pagamento sai somente em dinheiro.",
      },
      { key: "troca_modelo", label: "Modelo / Versão", type: "text", section: SECAO_TROCA },
      { key: "troca_ano", label: "Ano Fabricação / Modelo", type: "text", section: SECAO_TROCA },
      { key: "troca_cor", label: "Cor", type: "text", section: SECAO_TROCA },
      { key: "troca_placa", label: "Placa", type: "text", section: SECAO_TROCA },
      { key: "troca_chassi", label: "Chassi", type: "text", section: SECAO_TROCA },
      { key: "troca_renavam", label: "RENAVAM", type: "text", section: SECAO_TROCA },
      {
        key: "troca_valor",
        label: "Valor atribuído ao veículo da troca (R$)",
        type: "text",
        section: SECAO_TROCA,
        hint: "Ex.: 160.000,00 — o valor por extenso é gerado automaticamente.",
      },
      {
        key: "troca_volta",
        label: "Volta em dinheiro (R$)",
        type: "text",
        section: SECAO_TROCA,
        hint: "Diferença em dinheiro da troca. Ex.: 70.000,00. Em branco, o veículo da troca quita o preço integralmente.",
      },
      {
        key: "troca_volta_direcao",
        label: "Quem paga a volta?",
        type: "select",
        options: ["COMPRADORA (Vamaq) paga ao vendedor", "Vendedor paga à COMPRADORA (Vamaq)"],
        section: SECAO_TROCA,
        hint: "Vamaq paga quando o(s) veículo(s) comprado(s) valem mais que o da troca; o vendedor paga no caso inverso.",
      },
      {
        key: "valor_total",
        label: "Valor Total (R$)",
        type: "text",
        section: "Pagamento",
        hint: "Ex.: 158.000,00 — valor total do(s) veículo(s) comprado(s). Havendo troca, deve fechar com o valor do veículo da troca mais a volta. O extenso é gerado automaticamente se o campo abaixo ficar vazio.",
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
      {
        key: "clausulas_personalizadas",
        label: "Cláusulas Personalizadas (opcional)",
        type: "textarea",
        section: "Contrato",
        hint: "Condições específicas desta negociação. Entram ao final do contrato como cláusula DISPOSIÇÕES ESPECIAIS, antes do foro. Em branco, a cláusula não entra.",
      },
    ],
  },
  {
    id: "venda",
    name: "Contrato de Venda de Veículo",
    description:
      "A VAMAQ VENDE um veículo do estoque ao cliente — comprador pessoa física ou empresa, com um ou mais veículos recebidos na troca (inclusive de terceiros) e volta ou saldo em dinheiro",
    build: buildVenda,
    fields: [
      {
        key: "comprador_nome",
        label: "Nome / Razão Social do Comprador",
        type: "text",
        section: "Comprador (dados da CNH ou CNPJ)",
        hint: "Pessoa física (dados da CNH) ou empresa (razão social) que compra o veículo.",
      },
      { key: "comprador_cpf", label: "CPF / CNPJ do Comprador", type: "text", section: "Comprador (dados da CNH ou CNPJ)" },
      { key: "comprador_cnh", label: "Nº de Registro da CNH", type: "text", section: "Comprador (dados da CNH ou CNPJ)" },
      { key: "comprador_cnh_categoria", label: "Categoria da CNH", type: "text", section: "Comprador (dados da CNH ou CNPJ)" },
      {
        key: "comprador_representante_nome",
        label: "Representante Legal (se empresa)",
        type: "text",
        section: "Comprador (dados da CNH ou CNPJ)",
        hint: "Preencha quando o comprador for empresa — quem assina por ela. Em branco, o comprador assina em nome próprio.",
      },
      { key: "comprador_representante_cpf", label: "CPF do Representante", type: "text", section: "Comprador (dados da CNH ou CNPJ)" },
      { key: "comprador_endereco", label: "Endereço do Comprador", type: "text", section: "Comprador (dados da CNH ou CNPJ)" },
      { key: "comprador_telefone", label: "Telefone do Comprador", type: "text", section: "Comprador (dados da CNH ou CNPJ)" },
      { key: "comprador_email", label: "E-mail do Comprador", type: "text", section: "Comprador (dados da CNH ou CNPJ)" },
      {
        key: "anuente_nome",
        label: "Nome do Anuente",
        type: "text",
        section: "Anuente — proprietário registral do veículo vendido (opcional)",
        hint: "Preencha somente se o veículo vendido estiver registrado em nome de outra pessoa (ex.: veículo em consignação). Em branco, o contrato sai sem anuente.",
      },
      { key: "anuente_cpf", label: "CPF/CNPJ do Anuente", type: "text", section: "Anuente — proprietário registral do veículo vendido (opcional)" },
      { key: "anuente_endereco", label: "Endereço do Anuente", type: "text", section: "Anuente — proprietário registral do veículo vendido (opcional)" },
      ...veiculoCompraFields("veiculo", "Veículo vendido (dados do CRLV)").filter(
        (f) => f.key !== "veiculo_valor"
      ),
      ...CHECKLIST_ITENS_FIELDS,
      ...veiculoTrocaFields(
        "troca",
        "Troca — veículo 1 recebido do comprador (opcional)",
        "Preencha quando o comprador der um ou mais veículos como parte do pagamento. Em branco, a venda sai somente em dinheiro."
      ),
      ...veiculoTrocaFields(
        "troca2",
        "Troca — veículo 2 recebido do comprador (opcional)",
        "Preencha somente se o comprador der um segundo veículo na troca."
      ),
      ...veiculoTrocaFields(
        "troca3",
        "Troca — veículo 3 recebido do comprador (opcional)",
        "Preencha somente se o comprador der um terceiro veículo na troca."
      ),
      {
        key: "venda_diferenca",
        label: "Diferença em dinheiro (R$)",
        type: "text",
        section: SECAO_DIFERENCA,
        hint: "Ex.: 70.000,00 — volta paga pela Vamaq quando os veículos da troca valem mais que o vendido, ou saldo pago pelo comprador no caso inverso. Em branco, a troca quita o preço integralmente.",
      },
      {
        key: "venda_diferenca_direcao",
        label: "Quem paga a diferença?",
        type: "select",
        options: ["VENDEDORA (Vamaq) paga a volta ao comprador", "COMPRADOR paga o saldo à Vamaq"],
        section: SECAO_DIFERENCA,
      },
      {
        key: "volta_favorecido_nome",
        label: "Favorecido da Volta (opcional)",
        type: "text",
        section: SECAO_DIFERENCA,
        hint: "Preencha para pagar a volta a terceiro indicado pelo comprador (ex.: a empresa dele). Em branco, a volta sai em favor do próprio comprador.",
      },
      { key: "volta_favorecido_doc", label: "CPF/CNPJ do Favorecido", type: "text", section: SECAO_DIFERENCA },
      { key: "volta_favorecido_pix", label: "Chave PIX do Favorecido", type: "text", section: SECAO_DIFERENCA },
      { key: "volta_favorecido_banco", label: "Banco", type: "text", section: SECAO_DIFERENCA },
      { key: "volta_favorecido_agencia", label: "Agência", type: "text", section: SECAO_DIFERENCA },
      { key: "volta_favorecido_conta", label: "Conta", type: "text", section: SECAO_DIFERENCA },
      {
        key: "valor_total",
        label: "Preço do Veículo Vendido (R$)",
        type: "text",
        section: "Preço",
        hint: "Ex.: 230.000,00 — havendo troca, deve fechar com a soma dos veículos recebidos menos a volta (ou mais o saldo). O extenso é gerado automaticamente se o campo abaixo ficar vazio.",
      },
      { key: "valor_extenso", label: "Preço por Extenso (opcional)", type: "text", section: "Preço" },
      { key: "data_contrato", label: "Data do Contrato", type: "date", section: "Contrato" },
      {
        key: "clausulas_personalizadas",
        label: "Cláusulas Personalizadas (opcional)",
        type: "textarea",
        section: "Contrato",
        hint: "Condições específicas desta negociação. Entram ao final do contrato como cláusula DISPOSIÇÕES ESPECIAIS, antes do foro. Em branco, a cláusula não entra.",
      },
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
      ...CHECKLIST_ITENS_FIELDS,
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
      {
        key: "clausulas_personalizadas",
        label: "Cláusulas Personalizadas (opcional)",
        type: "textarea",
        section: "Condições",
        hint: "Condições específicas desta negociação. Entram ao final do contrato como cláusula DISPOSIÇÕES ESPECIAIS, antes do foro. Em branco, a cláusula não entra.",
      },
    ],
  },
  {
    id: "termo-vistoria",
    name: "Termo de Vistoria de Veículo em Consignação",
    description:
      "Vistoria de entrega com quilometragem por escrito, checklist de conservação, avarias e registro fotográfico opcional em anexo",
    build: buildTermoVistoria,
    fields: [
      { key: "proprietario_nome", label: "Nome do Consignante", type: "text", section: "Consignante (dados da CNH)" },
      { key: "proprietario_cpf", label: "CPF do Consignante", type: "text", section: "Consignante (dados da CNH)" },
      { key: "proprietario_telefone", label: "Telefone do Consignante", type: "text", section: "Consignante (dados da CNH)" },
      { key: "veiculo_marca", label: "Marca", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_modelo", label: "Modelo / Versão", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_ano", label: "Ano Fabricação / Modelo", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_cor", label: "Cor", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_placa", label: "Placa", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_chassi", label: "Chassi", type: "text", section: "Veículo (dados do CRLV)" },
      { key: "veiculo_renavam", label: "RENAVAM", type: "text", section: "Veículo (dados do CRLV)" },
      {
        key: "veiculo_km",
        label: "Quilometragem (km)",
        type: "text",
        section: "Veículo (dados do CRLV)",
        hint: "Ex.: 130.726 — sai na ficha do veículo e por extenso no corpo do termo.",
      },
      { key: "veiculo_combustivel", label: "Combustível", type: "text", section: "Veículo (dados do CRLV)" },
      ...CHECKLIST_VISTORIA.map(([key, rotulo]) => ({
        key,
        label: rotulo,
        type: "select",
        options: ["Bom", "Regular", "Com avaria (ver observações)"],
        section: "Estado de conservação",
      })),
      {
        key: "avarias_observacoes",
        label: "Avarias e Observações",
        type: "textarea",
        section: "Vistoria",
        hint: "Descreva avarias preexistentes, faltas e acessórios. Em branco, o termo registra que nenhuma avaria foi apontada.",
      },
      {
        key: "registro_fotografico",
        label: "Registro fotográfico em anexo?",
        type: "select",
        options: ["Sim", "Não"],
        section: "Vistoria",
        hint: "Com Sim, o termo menciona as fotos como ANEXO I (as fotos são impressas/anexadas à parte).",
      },
      { key: "fotos_quantidade", label: "Quantidade de Fotos", type: "text", section: "Vistoria" },
      { key: "data_contrato", label: "Data da Vistoria", type: "date", section: "Vistoria" },
    ],
  },
];
