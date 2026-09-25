/**
 * Prova a devolução de consignação na SEFAZ de HOMOLOGAÇÃO antes de qualquer
 * cliente clicar em produção.
 *
 * POR QUE EXISTE (25/09/2026): a devolução do BMW X6 foi recusada DUAS vezes
 * em produção — primeiro por falta da finalidade 4 e da nota referenciada,
 * depois pela forma de pagamento (rejeição 871). A SEFAZ valida uma regra por
 * vez e só mostra a primeira que falha, então corrigir e pedir para a Mayra
 * tentar de novo é usar a cliente como bancada de teste. Este script roda o
 * ciclo inteiro — entrada de consignação e devolução referenciando-a — no
 * ambiente de homologação da Focus, com os MESMOS montadores de payload que
 * a produção usa. Só quando a devolução sair "autorizado" aqui é que o
 * conserto vai para o ar.
 *
 * Como rodar (do Mac, sem tocar na VPS):
 *   1. No .env.local, FOCUS_NFE_TOKEN_HOMOLOGACAO=<token de homologação do
 *      painel da Focus — é um token DIFERENTE do de produção>.
 *   2. node --env-file=.env.local scripts/homologar-devolucao-consignacao.mjs
 *
 * O script NUNCA fala com a produção: força FOCUS_NFE_ENV=homologacao e usa
 * só o token de homologação. Sem esse token, para antes de qualquer chamada.
 * Cada execução emite duas notas de homologação (sem valor fiscal).
 */
import {
  montarPayloadEntrada,
  montarPayloadDevolucaoConsignacao,
} from "../src/lib/fiscal/payload.js";

const tokenHomolog = process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO;
if (!tokenHomolog) {
  console.error(
    "FOCUS_NFE_TOKEN_HOMOLOGACAO ausente no .env.local. É o token de HOMOLOGAÇÃO do painel da Focus (diferente do de produção)."
  );
  process.exit(2);
}
// Trava dupla: o client lê estas duas variáveis em cada chamada.
process.env.FOCUS_NFE_TOKEN = tokenHomolog;
process.env.FOCUS_NFE_ENV = "homologacao";

const { emitirNfe, consultarNfe } = await import("../src/lib/fiscal/focus/client.js");

// Os mesmos parâmetros que db/fiscal-schema.sql e db/fiscal-entrada.sql
// gravam para a Vamaq — e que tests/fiscal-entrada.test.mjs trava.
const CONFIG = {
  cnpj: "45.348.469/0001-54",
  ncm: "87032100",
  serie: "2",
  origem: "0",
  uf: "MG",
  cfop_entrada: "1102",
  natureza_entrada: "Compra Dentro do Estado",
  cfop_entrada_consignacao: "1917",
  natureza_entrada_consignacao: "Entrada de mercadoria em consignacao mercantil",
  cfop_entrada_interestadual: "2102",
  cfop_entrada_consignacao_interestadual: "2917",
  natureza_entrada_interestadual: "Compra Fora do Estado",
  cfop_devolucao_consignacao: "5918",
  cfop_devolucao_consignacao_interestadual: "6918",
  natureza_devolucao_consignacao: "Devolucao de mercadoria em consignacao mercantil",
  cst_entrada: "041",
  modalidade_frete_entrada: "1",
  indicador_pagamento: "1",
  forma_pagamento: "99",
  descricao_pagamento: "A prazo",
};

// Carro e consignante de teste. Em homologação a SEFAZ troca o nome do
// destinatário pelo texto padrão "SEM VALOR FISCAL"; o CPF precisa ser válido.
const VEICULO = {
  brand: "BMW",
  model: "X6 M Competition",
  year: 2024,
  placa: "HML0A01",
  chassi: "WBAGV8C09RCN12345",
};
const CONSIGNANTE = {
  nome: "Consignante de Homologacao",
  doc: "529.982.247-25",
  cep: "38411-108",
  logradouro: "Rua Exemplo",
  numero: "10",
  bairro: "Centro",
  municipio: "Uberlândia",
  uf: "MG",
};
const VALOR = 780000;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Consulta até a SEFAZ responder — a Focus é assíncrona. */
async function aguardar(ref, { tentativas = 30, intervaloMs = 2000 } = {}) {
  for (let i = 0; i < tentativas; i++) {
    const r = await consultarNfe(ref);
    if (r?.status && r.status !== "processando_autorizacao") return r;
    await dormir(intervaloMs);
  }
  throw new Error(`SEFAZ de homologação não respondeu para ${ref} em ${tentativas * intervaloMs / 1000}s`);
}

function relatar(rotulo, r) {
  const linha = {
    status: r?.status,
    status_sefaz: r?.status_sefaz,
    mensagem_sefaz: r?.mensagem_sefaz,
    numero: r?.numero,
    serie: r?.serie,
    chave_nfe: r?.chave_nfe,
  };
  console.log(`\n== ${rotulo} ==`);
  console.log(JSON.stringify(linha, null, 2));
  if (Array.isArray(r?.erros) && r.erros.length) console.log("erros:", JSON.stringify(r.erros, null, 2));
}

async function emitirEEsperar(rotulo, ref, payload) {
  console.log(`\n-> ${rotulo}: enviando ${ref}`);
  try {
    await emitirNfe(ref, payload);
  } catch (err) {
    // Recusa na pré-validação da Focus (antes da SEFAZ): já é resposta.
    console.log(`\n== ${rotulo}: recusada pela Focus antes da SEFAZ ==`);
    console.log(err.message);
    if (err.focus) console.log(JSON.stringify(err.focus, null, 2));
    return null;
  }
  const r = await aguardar(ref);
  relatar(rotulo, r);
  return r;
}

const carimbo = Date.now();

// 1. Entrada de consignação (CFOP 1917), como a Mayra emite.
const entrada = montarPayloadEntrada({
  config: CONFIG,
  veiculo: VEICULO,
  remetente: CONSIGNANTE,
  valorAquisicao: VALOR,
  consignacao: true,
});
if (entrada.error) {
  console.error("payload da entrada inválido:", entrada.error);
  process.exit(1);
}
const rEntrada = await emitirEEsperar("ENTRADA DE CONSIGNAÇÃO", `homolog-ent-${carimbo}`, entrada.payload);
if (rEntrada?.status !== "autorizado") {
  console.error("\nA entrada não autorizou em homologação — a devolução não tem o que referenciar. Parando.");
  process.exit(1);
}

// 2. Devolução ao consignante, referenciando a entrada que acabou de sair.
const devolucao = montarPayloadDevolucaoConsignacao({
  config: CONFIG,
  veiculo: VEICULO,
  consignante: CONSIGNANTE,
  valor: VALOR,
  chaveNotaEntrada: rEntrada.chave_nfe,
});
if (devolucao.error) {
  console.error("payload da devolução inválido:", devolucao.error);
  process.exit(1);
}
console.log("\npayload da devolução (campos que a SEFAZ cobrou):", JSON.stringify({
  finalidade_emissao: devolucao.payload.finalidade_emissao,
  notas_referenciadas: devolucao.payload.notas_referenciadas,
  formas_pagamento: devolucao.payload.formas_pagamento,
  cfop: devolucao.payload.items[0].cfop,
  tipo_documento: devolucao.payload.tipo_documento,
}, null, 2));
const rDev = await emitirEEsperar("DEVOLUÇÃO DE CONSIGNAÇÃO", `homolog-dev-${carimbo}`, devolucao.payload);

if (rDev?.status === "autorizado") {
  console.log("\n✔ DEVOLUÇÃO AUTORIZADA em homologação. Pode ir para produção.");
  process.exit(0);
}
console.error("\n✖ A devolução NÃO autorizou. Corrigir antes de qualquer pessoa clicar em produção.");
process.exit(1);
