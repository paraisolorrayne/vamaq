/**
 * Cliente da Focus NFe (emissão de NF-e modelo 55).
 *
 * Ativa quando as variáveis estiverem no .env.local:
 *   FOCUS_NFE_TOKEN — token da conta Focus
 *   FOCUS_NFE_ENV   — 'homologacao' (default) ou 'producao'
 *
 * Sem token, focusEnabled() é false e nenhuma chamada acontece. A emissão é assíncrona:
 * o POST devolve "processando_autorizacao" e a autorização vem na consulta.
 */
const BASES = {
  homologacao: "https://homologacao.focusnfe.com.br/v2",
  producao: "https://api.focusnfe.com.br/v2",
};

/** HTTP Basic: token como usuário, senha vazia (não é Bearer). */
function authHeader() {
  const token = Buffer.from(`${process.env.FOCUS_NFE_TOKEN}:`).toString("base64");
  return { Authorization: `Basic ${token}` };
}

export function focusEnabled() {
  return Boolean(process.env.FOCUS_NFE_TOKEN);
}

function baseUrl() {
  return BASES[process.env.FOCUS_NFE_ENV === "producao" ? "producao" : "homologacao"];
}

/**
 * A Focus devolve `caminho_xml_nota_fiscal`/`caminho_danfe` como caminho
 * relativo à RAIZ do host (ex.: "/arquivos/...xml"), não como URL. `baseUrl()`
 * termina em "/v2", então a URL final se monta contra a origem, sem o "/v2".
 */
export function focusFileUrl(caminho) {
  if (!caminho) return null;
  const origem = new URL(baseUrl()).origin;
  return `${origem}${caminho.startsWith("/") ? "" : "/"}${caminho}`;
}

/**
 * Baixa um arquivo já emitido (XML ou DANFE) pela URL que a Focus devolveu.
 *
 * Não passa por `focusFetch`: aqui a URL é absoluta (fora do /v2) e a resposta
 * é o arquivo, não JSON. O timeout é curto de propósito — no pacote mensal são
 * dezenas de arquivos, e um servidor pendurado não pode segurar o download
 * inteiro. Quem chama trata a exceção e registra a nota como faltante.
 */
export async function baixarArquivo(url, { timeoutMs = 20000 } = {}) {
  // SEM credencial primeiro: esse endereço serve arquivo estático — é o mesmo
  // que a operadora abre no navegador, deslogada. Mandar Basic para um caminho
  // que não pede pode voltar 401, e aí o pacote mensal inteiro viraria uma
  // lista de faltantes por causa de um header que ninguém pediu.
  let res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });

  // Se o servidor pedir credencial, aí sim: uma tentativa com o token.
  if ((res.status === 401 || res.status === 403) && focusEnabled()) {
    res = await fetch(url, {
      headers: authHeader(),
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function focusFetch(path, { method = "GET", body } = {}) {
  if (!focusEnabled()) throw new Error("Focus NFe não configurada (FOCUS_NFE_TOKEN ausente).");
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A Focus manda a mensagem curta em `mensagem` e o detalhamento em `erros`
    // — e a curta às vezes é literalmente "verifique o detalhamento dos erros".
    // Pegar só a primeira e descartar o resto deixava o operador com um erro
    // que manda olhar um detalhe que ninguém mostrava. Aconteceu em 11/08/2026.
    const erro = new Error(mensagemDeErro(data, res.status));
    erro.focus = data; // resposta inteira, para gravar em notas_fiscais.raw
    erro.status = res.status;
    throw erro;
  }
  return data;
}

/** Junta a mensagem curta com o detalhamento, quando a Focus manda os dois. */
export function mensagemDeErro(data, httpStatus) {
  const curta = data?.mensagem || data?.erro || "";
  const detalhes = Array.isArray(data?.erros)
    ? data.erros
        .map((e) => (typeof e === "string" ? e : [e?.campo, e?.mensagem].filter(Boolean).join(": ")))
        .filter(Boolean)
    : [];

  if (curta && detalhes.length) return `${curta} — ${detalhes.join(" · ")}`;
  if (detalhes.length) return detalhes.join(" · ");
  if (curta) return curta;
  return `Focus HTTP ${httpStatus}`;
}

export function emitirNfe(ref, payload) {
  return focusFetch(`/nfe?ref=${encodeURIComponent(ref)}`, { method: "POST", body: payload });
}

export function consultarNfe(ref) {
  return focusFetch(`/nfe/${encodeURIComponent(ref)}?completa=1`);
}

/**
 * Cancela uma NF-e autorizada.
 *
 * É `DELETE /nfe/{ref}` com a justificativa no corpo — NÃO
 * `POST /nfe/{ref}/cancel`, que era o que estava aqui e devolvia "Endpoint não
 * encontrado" (a Mayra tentou cancelar a NF 17 em 22/08/2026 e levou esse
 * erro, sem saber que era defeito nosso e não regra da SEFAZ).
 *
 * Síncrono: a resposta já traz o resultado. Prazo de 24 horas após a emissão,
 * podendo ser maior em alguns estados. Justificativa entre 15 e 255
 * caracteres — limite da SEFAZ, conferido aqui para o erro sair em português.
 */
export function cancelarNfe(ref, justificativa) {
  const texto = String(justificativa ?? "").trim();
  if (texto.length < 15) {
    return Promise.reject(
      new Error(
        `A justificativa do cancelamento precisa de pelo menos 15 caracteres — tem ${texto.length}.`
      )
    );
  }
  if (texto.length > 255) {
    return Promise.reject(
      new Error(
        `A justificativa do cancelamento aceita no máximo 255 caracteres — tem ${texto.length}.`
      )
    );
  }
  return focusFetch(`/nfe/${encodeURIComponent(ref)}`, {
    method: "DELETE",
    body: { justificativa: texto },
  });
}

/**
 * Emite uma Carta de Correção Eletrônica para uma NF-e já autorizada.
 *
 * O QUE ELA RESOLVE: nota autorizada com erro em campo que NÃO determina
 * imposto. É a saída quando o prazo de cancelamento de 24 horas venceu — o que
 * acontece sempre que o erro aparece num fim de semana.
 *
 * O QUE ELA NÃO CORRIGE (regra da SEFAZ, não da Focus): as variáveis que
 * determinam o valor do imposto (base de cálculo, alíquota), dados que mudem
 * quem é o remetente ou o destinatário, e a data de emissão ou de saída. Para
 * esses, o caminho é cancelar — ou, fora do prazo, emitir a contra-nota.
 *
 * A SEFAZ aceita até 20 correções na mesma nota, e vale sempre a última.
 * Síncrono: a resposta já traz o resultado.
 */
export function cartaCorrecaoNfe(ref, correcao) {
  const texto = String(correcao ?? "").trim();
  if (texto.length < 15) {
    return Promise.reject(
      new Error(
        `A carta de correção precisa de pelo menos 15 caracteres — tem ${texto.length}.`
      )
    );
  }
  if (texto.length > 1000) {
    return Promise.reject(
      new Error(
        `A carta de correção aceita no máximo 1000 caracteres — tem ${texto.length}.`
      )
    );
  }
  return focusFetch(`/nfe/${encodeURIComponent(ref)}/carta_correcao`, {
    method: "POST",
    body: { correcao: texto },
  });
}
