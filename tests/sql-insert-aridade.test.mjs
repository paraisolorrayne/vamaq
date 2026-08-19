/**
 * Todo INSERT do projeto tem um valor para cada coluna que lista.
 *
 * O BUG QUE ORIGINOU ESTE TESTE (19/08/2026): a Mayra clicou para emitir a nota
 * de um veículo consignado e recebeu uma tela branca — "A server error
 * occurred". No log: `INSERT has more expressions than target columns`. O
 * comando listava sete colunas e mandava oito valores.
 *
 * O que torna essa família de defeito perigosa é que NADA a pega: para o
 * JavaScript o SQL é uma string, então o build compila e o lint não olha. Ela
 * só aparece quando alguém em produção aperta o botão — e some da tela como
 * erro genérico, sem dizer o que houve.
 *
 * Este teste lê o código-fonte e confere a aritmética. É barato e cobre todos
 * os INSERTs de uma vez, inclusive os que ninguém lembrou de testar.
 *
 * O parser respeita parênteses aninhados: `values ($1, coalesce($2, now()), $3)`
 * são TRÊS valores, não cinco. Uma versão ingênua que corta por vírgula acusa
 * erro onde não há — e teste que dá alarme falso é pior que teste nenhum,
 * porque ensina a ignorá-lo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function arquivosJs(dir) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const caminho = path.join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivosJs(caminho));
    else if (nome.endsWith(".js")) saida.push(caminho);
  }
  return saida;
}

/** Divide por vírgulas do nível de cima, ignorando as de dentro de parênteses. */
function campos(txt) {
  const saida = [];
  let nivel = 0;
  let atual = "";
  for (const ch of txt) {
    if (ch === "(") nivel += 1;
    else if (ch === ")") nivel -= 1;
    if (ch === "," && nivel === 0) {
      saida.push(atual);
      atual = "";
    } else {
      atual += ch;
    }
  }
  saida.push(atual);
  return saida.map((c) => c.trim()).filter(Boolean);
}

/** Conteúdo do parêntese que abre em `i`, respeitando aninhamento. */
function bloco(s, i) {
  if (s[i] !== "(") return null;
  let nivel = 0;
  for (let j = i; j < s.length; j += 1) {
    if (s[j] === "(") nivel += 1;
    else if (s[j] === ")") {
      nivel -= 1;
      if (nivel === 0) return { texto: s.slice(i + 1, j), fim: j };
    }
  }
  return null;
}

function insertsDe(fonte) {
  const achados = [];
  const re = /insert into\s+([\w.]+)\s*(?=\()/gi;
  let m;
  while ((m = re.exec(fonte)) !== null) {
    const cols = bloco(fonte, m.index + m[0].length);
    if (!cols) continue;
    const mv = /^\s*values\s*(?=\()/i.exec(fonte.slice(cols.fim + 1));
    if (!mv) continue;
    const vals = bloco(fonte, cols.fim + 1 + mv[0].length);
    if (!vals) continue;
    achados.push({
      tabela: m[1],
      colunas: cols.texto,
      valores: vals.texto,
      linha: fonte.slice(0, m.index).split("\n").length,
    });
  }
  return achados;
}

test("nenhum INSERT tem mais (ou menos) valores que colunas", () => {
  const falhas = [];
  let conferidos = 0;

  for (const arquivo of arquivosJs(path.join(ROOT, "src"))) {
    const fonte = readFileSync(arquivo, "utf8");
    for (const ins of insertsDe(fonte)) {
      // Lista de colunas montada em JavaScript (`${CAMPOS.join(", ")}`) não dá
      // para contar aqui. Nesses casos os marcadores TÊM que ser derivados da
      // mesma lista — conferir isso é trabalho de quem escreve, não deste teste.
      if (ins.colunas.includes("${")) continue;
      conferidos += 1;
      const c = campos(ins.colunas).length;
      const v = campos(ins.valores).length;
      if (c !== v) {
        const rel = path.relative(ROOT, arquivo);
        falhas.push(`${rel}:${ins.linha} — ${ins.tabela}: ${c} colunas para ${v} valores`);
      }
    }
  }

  assert.ok(conferidos >= 15, `esperava conferir vários INSERTs, conferi ${conferidos}`);
  assert.deepEqual(falhas, [], `INSERT com aritmética errada:\n  ${falhas.join("\n  ")}`);
});

test("o parser não se perde com função dentro do values", () => {
  // `coalesce($2, current_date)` é UM valor. A versão ingênua conta três e
  // acusa erro onde não existe — foi o que aconteceu quando escrevi a primeira
  // versão desta checagem.
  const fonte = `
    query(\`insert into fin.transactions (a, b, c)
           values ($1, coalesce($2, current_date), $3)\`)
  `;
  const [ins] = insertsDe(fonte);
  assert.equal(campos(ins.colunas).length, 3);
  assert.equal(campos(ins.valores).length, 3);
});

test("e realmente acusa quando falta uma coluna", () => {
  const fonte = `
    query(\`insert into notas_fiscais (ref, vehicle_id, status)
           values ($1, $2, 'processando', $3)\`)
  `;
  const [ins] = insertsDe(fonte);
  assert.notEqual(campos(ins.colunas).length, campos(ins.valores).length);
});
