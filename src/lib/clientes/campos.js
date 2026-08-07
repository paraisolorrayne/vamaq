/**
 * Validação e normalização dos campos do cadastro de cliente. Puro — sem I/O.
 *
 * Extraído de repo.js (que importa "@/lib/db" e por isso é intestável em
 * `node --test`, onde o alias "@/" não resolve). A checagem de documento
 * duplicado FICA em repo.js — ela precisa do pool. Aqui só entra o que dá
 * para decidir olhando só para o objeto do formulário.
 *
 * Puro de propósito (import relativo com extensão, só de doc.js): é usado
 * pela tela, pela API (via repo.js) e pelo teste.
 */
import { normalizaDoc, tipoPorDoc, docValido } from "./doc.js";

// Mesma classe de defeito já corrigida no `obs` do vínculo (ligarVeiculo):
// campo opcional que chega não-string (ex.: {"rg":123}) quebra em
// `.trim is not a function` antes de virar {error}. `String(v ?? "")`
// aceita qualquer tipo sem lançar.
const txt = (v) => String(v ?? "").trim() || null;

/**
 * Valida e normaliza o que veio do formulário. Retorna {values} ou {error}.
 * Não toca em banco — quem chama decide o que fazer com `values.doc` (ex.:
 * checar duplicidade) antes de gravar.
 */
export function prepararCampos(data) {
  const nome = String(data.nome || "").trim();
  if (!nome) return { error: "Nome é obrigatório." };

  const doc = normalizaDoc(data.doc);
  if (doc && !docValido(doc)) return { error: "CPF/CNPJ deve ter 11 ou 14 dígitos." };

  // Se o documento tem tamanho conhecido (11 ou 14 dígitos), ele decide o
  // tipo — só cai no que veio do formulário quando o documento está vazio
  // ou é curto demais para saber.
  let tipo = tipoPorDoc(doc) || data.tipo || "pf";
  if (tipo !== "pf" && tipo !== "pj") tipo = "pf";

  const cep = normalizaDoc(data.cep);
  const representanteCpf = normalizaDoc(data.representante_cpf);
  const uf = String(data.uf || "").trim().toUpperCase().slice(0, 2);
  const email = txt(data.email);

  return {
    values: {
      nome,
      tipo,
      doc: doc || null,
      rg: txt(data.rg),
      cnh: txt(data.cnh),
      cnh_categoria: txt(data.cnh_categoria),
      email: email ? email.toLowerCase() : null,
      telefone: txt(data.telefone),
      cep: cep || null,
      logradouro: txt(data.logradouro),
      numero: txt(data.numero),
      complemento: txt(data.complemento),
      bairro: txt(data.bairro),
      municipio: txt(data.municipio),
      uf: uf || null,
      representante_nome: txt(data.representante_nome),
      representante_cpf: representanteCpf || null,
      obs: txt(data.obs),
    },
  };
}
