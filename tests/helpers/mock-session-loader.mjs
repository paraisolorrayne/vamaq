/**
 * Hook de carregamento de módulos (node:module.register) usado só pelo teste
 * de autorização (clientes-autorizacao.test.mjs) para importar as rotas de
 * verdade — src/app/api/admin/clientes/**\/route.js — em `node --test`.
 *
 * Duas resoluções que o Node puro não faz sozinho, sem tocar em código de
 * produção nem no package.json:
 *
 *   1. O alias "@/*" (definido em jsconfig.json para o webpack do Next) não
 *      existe para o resolvedor do Node. Reescrevemos "@/x" para o arquivo
 *      relativo em src/x.js.
 *
 *   2. "next/server" e "next/headers" são importados sem extensão nas rotas
 *      — o pacote `next` não declara "exports" no package.json, então CJS
 *      via require() acha a extensão sozinho, mas ESM via import não. Aqui
 *      completamos para "next/server.js" / "next/headers.js", que existem
 *      de verdade no pacote.
 *
 * A peça que importa: "@/lib/auth/session" — de onde requireApiRole tira o
 * usuário logado — é redirecionada para um módulo falso definido abaixo em
 * vez do arquivo de verdade. O arquivo de verdade chama `cookies()` de
 * "next/headers", que lança fora de uma request real do Next
 * ("cookies() called outside a request scope") — não dá para testar com o
 * módulo real de jeito nenhum fora do runtime do Next, mockado ou não. O
 * módulo falso lê `globalThis.__TEST_SESSION_USER__`, que o teste seta antes
 * de cada chamada — assim cada handler é exercitado com o usuário de cada
 * papel, sem precisar de cookie nem de banco de sessões.
 */
import { fileURLToPath } from "node:url";

const SRC_URL = new URL("../../src/", import.meta.url);
const MOCK_SESSION_URL = "mock-session:main";

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/auth/session") {
    return { url: MOCK_SESSION_URL, shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const alvo = new URL(`${specifier.slice(2)}.js`, SRC_URL);
    return nextResolve(alvo.href, context);
  }
  if (specifier === "next/server" || specifier === "next/headers") {
    return nextResolve(`${specifier}.js`, context);
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === MOCK_SESSION_URL) {
    return {
      format: "module",
      shortCircuit: true,
      source: `
        export async function readSessionUser() {
          return globalThis.__TEST_SESSION_USER__ ?? null;
        }
      `,
    };
  }
  return nextLoad(url, context);
}

// Só para depuração manual; não é usado pelo teste.
export function _srcPath() {
  return fileURLToPath(SRC_URL);
}
