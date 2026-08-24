/**
 * O que fazer quando a nota dá erro — em português, na tela, sem precisar
 * perguntar a ninguém.
 *
 * POR QUE ISTO EXISTE: a SEFAZ e o emissor respondem em linguagem fiscal, às
 * vezes em inglês, citando tags de XML. Quem opera a loja lê "Rejeicao 539" ou
 * "facet maxLength on natOp" e não tem como saber se errou de digitação, se
 * falta um parâmetro do contador, ou se é defeito do sistema. Aí para tudo e
 * pergunta — e a resposta leva horas ou dias.
 *
 * Cada erro conhecido vira três coisas: o que aconteceu, o que fazer, e a
 * quem levar. O texto cru da SEFAZ continua aparecendo embaixo, porque é dele
 * que a contabilidade precisa.
 *
 * AGNÓSTICO POR DECISÃO: em lugar nenhum se fala o nome do contador. Diz-se
 * "a contabilidade". Contador muda; o sistema não pode precisar de deploy por
 * causa disso.
 *
 * Puro: sem banco e sem rede.
 */

/** A quem o problema pertence. Define o texto do botão e o tom da orientação. */
export const DONO = {
  OPERACAO: "operacao", // a loja resolve sozinha, mexendo no cadastro
  CONTABILIDADE: "contabilidade", // parâmetro ou decisão fiscal
  SUPORTE: "suporte", // defeito ou configuração do sistema
  ESPERAR: "esperar", // nada quebrado; é a SEFAZ ou o tempo
};

/**
 * Padrões conhecidos, do mais específico para o mais genérico. A ordem importa:
 * "Duplicidade de NF-e" também casaria com a regra genérica de "Rejeicao".
 */
const CONHECIDOS = [
  {
    quando: /duplicidade de nf-?e/i,
    resumo: "A numeração desta nota já foi usada antes.",
    oQueFazer:
      "Não é erro de preenchimento. A contagem de notas do sistema saiu de sincronia com a da SEFAZ, e isso se ajusta na configuração do emissor.",
    dono: DONO.SUPORTE,
  },
  {
    quando: /prazo.*cancelamento|cancelamento.*(expirad|venc)|fora do prazo/i,
    resumo: "Passou o prazo para cancelar esta nota.",
    oQueFazer:
      "Se o erro for em campo que NÃO muda valor de imposto — endereço, descrição, natureza da operação —, use a Carta de correção nesta mesma tela. Se mudar imposto, quem é o cliente, ou a data, o caminho é a contabilidade decidir entre cancelamento fora do prazo e nota de anulação.",
    dono: DONO.CONTABILIDADE,
  },
  {
    quando: /situa[cç][aã]o tribut[aá]ria|cst\b.*inv[aá]lid|cfop.*inv[aá]lid|al[ií]quota/i,
    resumo: "Um parâmetro fiscal da nota não foi aceito.",
    oQueFazer:
      "CST, CFOP e alíquota vêm da configuração fiscal da loja, não do que você digita. Leve o texto abaixo à contabilidade e peça o valor correto para esta operação.",
    dono: DONO.CONTABILIDADE,
  },
  {
    quando: /maxlength|exceeds the allowed maximum|excede.*tamanho|muito longo/i,
    resumo: "Um campo ficou maior do que a nota permite.",
    oQueFazer:
      "Encurte o campo indicado e emita de novo. Se o campo não estiver na tela de emissão, é configuração do sistema.",
    dono: DONO.OPERACAO,
  },
  {
    quando: /schema xml|campo.*obrigat[oó]ri|n[aã]o pode ser vazio|is required/i,
    resumo: "Está faltando um dado obrigatório na nota.",
    oQueFazer:
      "O nome do campo aparece no texto abaixo. Se for um dado do cliente ou do veículo, complete o cadastro e emita de novo. Se for um campo que não existe na tela, é configuração do sistema.",
    dono: DONO.OPERACAO,
  },
  {
    quando: /certificado.*(vencid|expirad|inv[aá]lid)|sem certificado/i,
    resumo: "O certificado digital da loja está vencido ou inválido.",
    oQueFazer:
      "Sem certificado válido nenhuma nota é assinada. A renovação é feita com a contabilidade ou com a certificadora — e vale conferir a validade antes que outras notas parem.",
    dono: DONO.CONTABILIDADE,
  },
  {
    quando: /inscri[cç][aã]o estadual|ie.*(inv[aá]lid|incorret)|cadastro.*destinat[aá]rio/i,
    resumo: "Os dados de cadastro do cliente não foram aceitos.",
    oQueFazer:
      "Confira CPF ou CNPJ, inscrição estadual e endereço no cadastro do cliente. Empresa precisa de inscrição estadual; pessoa física, não.",
    dono: DONO.OPERACAO,
  },
  {
    quando: /servi[cç]o.*(paralisad|indispon[ií]vel|fora do ar)|timeout|tempo esgotado|502|503|504/i,
    resumo: "A SEFAZ não respondeu agora.",
    oQueFazer:
      "Não é erro seu e nada foi perdido. Espere alguns minutos e emita de novo. Se persistir por horas, a SEFAZ costuma estar em manutenção.",
    dono: DONO.ESPERAR,
  },
  {
    quando: /endpoint n[aã]o encontrado|404|not found/i,
    resumo: "O sistema tentou um endereço que o emissor não reconhece.",
    oQueFazer:
      "Isto é defeito do sistema, não do seu preenchimento. Nada foi emitido. Avise o suporte técnico com o texto abaixo.",
    dono: DONO.SUPORTE,
  },
  {
    quando: /n[aã]o autorizado|unauthorized|401|token/i,
    resumo: "O sistema não conseguiu se autenticar no emissor.",
    oQueFazer:
      "É configuração do sistema, não do seu preenchimento. Nada foi emitido. Avise o suporte técnico.",
    dono: DONO.SUPORTE,
  },
];

/** O que dizer quando a mensagem não é reconhecida. */
const PADRAO = {
  resumo: "A SEFAZ recusou a nota, e este erro ainda não tem orientação própria.",
  oQueFazer:
    "Copie o texto abaixo e leve à contabilidade — ela lê a linguagem da SEFAZ e diz o que precisa mudar. Se a resposta for que está tudo certo do lado fiscal, aí é caso para o suporte técnico.",
  dono: DONO.CONTABILIDADE,
};

const ROTULO_DONO = {
  [DONO.OPERACAO]: "Você mesma resolve",
  [DONO.CONTABILIDADE]: "Leve à contabilidade",
  [DONO.SUPORTE]: "Avise o suporte técnico",
  [DONO.ESPERAR]: "Só esperar",
};

/**
 * Traduz a mensagem de erro de uma nota em orientação.
 *
 * Devolve sempre alguma coisa: o pior caso é a orientação padrão, que manda
 * levar o texto à contabilidade. Nunca devolve nulo — deixar a operadora sem
 * próximo passo é o problema que este módulo existe para resolver.
 */
export function orientacaoDoErro(mensagem) {
  const texto = String(mensagem ?? "").trim();
  const achado = texto ? CONHECIDOS.find((c) => c.quando.test(texto)) : null;
  const base = achado || PADRAO;
  return {
    resumo: base.resumo,
    oQueFazer: base.oQueFazer,
    dono: base.dono,
    rotuloDono: ROTULO_DONO[base.dono],
    reconhecido: Boolean(achado),
    mensagemOriginal: texto,
  };
}
