/**
 * Node.js ESM loader para resolver o alias @/ → ./src/
 * Usado em testes que rodam com node --test
 */
import { pathToFileURL, fileURLToPath } from "url";
import path from "path";

const baseDir = path.dirname(fileURLToPath(import.meta.url));

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    let resolved = path.join(baseDir, "src", specifier.slice(2));
    // Se não termina com .js ou .mjs, adiciona .js
    if (!resolved.match(/\.(mjs|js)$/)) {
      resolved = resolved + ".js";
    }
    const url = pathToFileURL(resolved).href;
    return nextResolve(url, context);
  }
  return nextResolve(specifier, context);
}
