/**
 * De um cliente cadastrado para os campos de cada modelo de contrato e para o
 * destinatário da NF-e.
 *
 * Testado em `node --test`, onde o alias "@/" não resolve — por isso os imports
 * abaixo são relativos e com extensão. Mesma razão de existir de
 * documentosCliente.js, que decide de qual campo sai o nome do cliente.
 */
import { normalizaDoc, formataDoc } from "./doc.js";
import { enderecoEmUmaLinha } from "./endereco.js";

// Qual ficha do contrato é a do cliente, e o que ele fez com o carro.
const MODELOS = {
  "compra-venda": { prefixo: "vendedor", papel: "vendeu" },
  venda: { prefixo: "comprador", papel: "comprou" },
  consignacao: { prefixo: "proprietario", papel: "consignou" },
  "termo-vistoria": { prefixo: "proprietario", papel: "consignou" },
};

export function papelPorTemplate(templateId) {
  return MODELOS[templateId]?.papel ?? null;
}

/** Prefixo dos campos da ficha do cliente naquele modelo — usado pelo botão
 *  "Salvar como cliente", que faz o caminho inverso do camposDoTemplate. */
export function prefixoDoTemplate(templateId) {
  return MODELOS[templateId]?.prefixo ?? null;
}

function texto(valor) {
  return String(valor ?? "").trim();
}

/** Campos a preencher no formulário do contrato. Campo vazio não entra. */
export function camposDoTemplate(templateId, cliente) {
  const modelo = MODELOS[templateId];
  if (!modelo || !cliente) return {};
  const p = modelo.prefixo;

  const candidatos = {
    [`${p}_nome`]: texto(cliente.nome),
    [`${p}_cpf`]: formataDoc(cliente.doc),
    [`${p}_cnh`]: texto(cliente.cnh),
    [`${p}_cnh_categoria`]: texto(cliente.cnh_categoria),
    [`${p}_endereco`]: enderecoEmUmaLinha(cliente),
    [`${p}_telefone`]: texto(cliente.telefone),
    [`${p}_email`]: texto(cliente.email),
  };

  // Representante só existe em PJ, e só o modelo de venda tem esses campos.
  if (cliente.tipo === "pj" && templateId === "venda") {
    candidatos.comprador_representante_nome = texto(cliente.representante_nome);
    candidatos.comprador_representante_cpf = formataDoc(cliente.representante_cpf);
  }

  const campos = {};
  for (const [chave, valor] of Object.entries(candidatos)) {
    if (valor) campos[chave] = valor;
  }
  return campos;
}

/**
 * O caminho inverso do camposDoTemplate: do que foi digitado no contrato para
 * o cadastro do cliente. Devolve null quando o contrato não tem nome.
 *
 * Fonte única — é usado pelo botão "Salvar como cliente" e pela gravação do
 * contrato (src/lib/documentos.js), que cadastra o cliente sozinha.
 *
 * O endereço NÃO vai para logradouro/município/UF: no contrato ele é uma linha
 * só, e a NF-e lê os campos separados (destinatarioDoCliente). Adivinhar a
 * quebra estragaria a nota. A linha fica na observação, para a secretaria
 * completar a ficha sem ter que reabrir o contrato.
 */
export function clienteDoContrato(templateId, values) {
  const modelo = MODELOS[templateId];
  if (!modelo || !values) return null;
  const p = modelo.prefixo;

  const nome = texto(values[`${p}_nome`]);
  if (!nome) return null;

  const endereco = texto(values[`${p}_endereco`]);
  const cliente = {
    nome,
    doc: texto(values[`${p}_cpf`]),
    cnh: texto(values[`${p}_cnh`]),
    cnh_categoria: texto(values[`${p}_cnh_categoria`]),
    telefone: texto(values[`${p}_telefone`]),
    email: texto(values[`${p}_email`]),
    obs: endereco ? `Endereço informado no contrato: ${endereco}` : "",
  };

  if (templateId === "venda") {
    cliente.representante_nome = texto(values.comprador_representante_nome);
    cliente.representante_cpf = texto(values.comprador_representante_cpf);
  }
  return cliente;
}

/** Destinatário da NF-e. Sempre com todas as chaves — a validação é na emissão. */
export function destinatarioDoCliente(cliente) {
  const c = cliente || {};
  return {
    nome: texto(c.nome),
    doc: normalizaDoc(c.doc),
    cep: normalizaDoc(c.cep),
    logradouro: texto(c.logradouro),
    numero: texto(c.numero),
    bairro: texto(c.bairro),
    municipio: texto(c.municipio),
    uf: texto(c.uf).toUpperCase(),
  };
}
