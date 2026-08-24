/**
 * Todo endereço que chamamos na Focus existe de verdade.
 *
 * O QUE ORIGINOU (22/08/2026): a Mayra foi cancelar uma nota emitida com CFOP
 * errado e recebeu "Endpoint não encontrado, verifique a documentação desta
 * API". O código chamava `POST /nfe/{ref}/cancel`. Esse endereço nunca
 * existiu — na Focus é `DELETE /nfe/{ref}`.
 *
 * O cancelamento estava quebrado desde que foi escrito. Passou por build,
 * lint e deploy, e ficou meses sem ninguém notar, porque só falha quando
 * alguém precisa daquela função pela primeira vez. Foi a Mayra descobrindo,
 * num sábado, com uma nota errada nas mãos e o prazo correndo.
 *
 * Este teste lê o código do cliente, extrai cada chamada e confere contra a
 * lista de endpoints que a Focus publica na própria especificação OpenAPI
 * (src/lib/fiscal/focus/endpoints-focus.json). Endereço inventado falha aqui,
 * na máquina de quem escreveu, e não na frente de quem opera.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLIENTE = path.join(ROOT, "src/lib/fiscal/focus/client.js");
const CATALOGO = path.join(ROOT, "src/lib/fiscal/focus/endpoints-focus.json");

/**
 * Extrai as chamadas do cliente e normaliza para a forma da documentação:
 * a interpolação vira `{referencia}` e a query string sai (não faz parte do
 * caminho).
 */
function chamadasDoCliente() {
  const fonte = readFileSync(CLIENTE, "utf8");
  const achadas = [];
  const re = /focusFetch\(\s*`([^`]+)`\s*(?:,\s*\{([^}]*)\})?/g;
  let m;
  while ((m = re.exec(fonte)) !== null) {
    const caminho = m[1]
      .replace(/\$\{[^}]*\}/g, "{referencia}")
      .split("?")[0];
    const metodo = /method:\s*"(\w+)"/.exec(m[2] || "")?.[1] || "GET";
    achadas.push({
      endpoint: `${metodo.toUpperCase()} ${caminho}`,
      linha: fonte.slice(0, m.index).split("\n").length,
    });
  }
  return achadas;
}

test("cada endereço chamado consta na documentação da Focus", () => {
  const { endpoints } = JSON.parse(readFileSync(CATALOGO, "utf8"));
  const validos = new Set(endpoints);
  const chamadas = chamadasDoCliente();

  assert.ok(chamadas.length >= 4, `esperava achar as chamadas do cliente, achei ${chamadas.length}`);

  const invalidas = chamadas.filter((c) => !validos.has(c.endpoint));
  assert.deepEqual(
    invalidas.map((c) => `client.js:${c.linha} — ${c.endpoint}`),
    [],
    "endereço que a Focus não documenta"
  );
});

test("o extrator reconhece a forma de cada chamada", () => {
  // Sem isto, um extrator que não achasse nada faria o teste acima passar
  // vazio — e a proteção viraria enfeite.
  const encontrados = chamadasDoCliente().map((c) => c.endpoint).sort();
  assert.deepEqual(encontrados, [
    "DELETE /nfe/{referencia}",
    "GET /nfe/{referencia}",
    "POST /nfe",
    "POST /nfe/{referencia}/carta_correcao",
  ]);
});

test("o endereço errado de antes seria pego", () => {
  const { endpoints } = JSON.parse(readFileSync(CATALOGO, "utf8"));
  assert.ok(
    !endpoints.includes("POST /nfe/{referencia}/cancel"),
    "o endereço que quebrou em produção não pode constar como válido"
  );
});
