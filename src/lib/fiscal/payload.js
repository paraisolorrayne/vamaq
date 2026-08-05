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
import { icmsSeminovo } from "../fin/calc.js";

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

  const aliquota = Number(config.icms_seminovo_aliquota ?? 5);
  const custo = Number(custoAquisicao) || 0;
  const base = Math.max(0, venda - custo);
  const icms = icmsSeminovo(venda, custo, aliquota);

  const doc = so_digitos(destinatario.doc);
  const ehCnpj = doc.length === 14;

  const descricao = [
    `${veiculo.brand} ${veiculo.model} ${veiculo.year}`,
    veiculo.placa ? `Placa ${veiculo.placa}` : null,
    `Chassi ${veiculo.chassi}`,
  ].filter(Boolean).join(" - ");

  const payload = {
    natureza_operacao: "Venda de mercadoria",
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
        icms_situacao_tributaria: String(config.cst),
        icms_base_calculo: base,
        icms_aliquota: aliquota,
        icms_valor: icms,
      },
    ],
  };

  return { payload, impostos: { base, aliquota, icms } };
}
