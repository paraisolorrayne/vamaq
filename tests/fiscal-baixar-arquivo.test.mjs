/**
 * Download de um arquivo já emitido (XML/DANFE) do emissor.
 *
 * O ARQUIVO É ESTÁTICO: o print da tela da Mayra mostra o XML abrindo no
 * navegador, sem login nenhum. Então a tentativa normal vai SEM header de
 * autenticação — mandar Basic para um caminho estático é o tipo de coisa que
 * um servidor pode responder com 401 e transformar o pacote inteiro num
 * "_faltando.txt". Só se o servidor pedir credencial é que a gente repete a
 * chamada com ela.
 *
 * Estes testes sobem um servidor HTTP local: provam o comportamento sem
 * depender da Focus estar no ar.
 *
 *   npm test
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { baixarArquivo } from "../src/lib/fiscal/focus/client.js";

const XML = '<nfeProc versao="4.00"><NFe/></nfeProc>';

let servidor;
let base;
/** Registro do que cada requisição trouxe, para conferir depois. */
let chamadas;

before(async () => {
  process.env.FOCUS_NFE_TOKEN = "token-de-teste";
  servidor = http.createServer((req, res) => {
    chamadas.push({ url: req.url, auth: req.headers.authorization || null });

    if (req.url === "/publico.xml") {
      res.writeHead(200, { "Content-Type": "text/xml" });
      return res.end(XML);
    }
    if (req.url === "/protegido.xml") {
      if (!req.headers.authorization) {
        res.writeHead(401);
        return res.end("nao autorizado");
      }
      res.writeHead(200, { "Content-Type": "text/xml" });
      return res.end(XML);
    }
    if (req.url === "/pendurado.xml") {
      return; // nunca responde — é o caso do timeout
    }
    res.writeHead(404);
    res.end("nao encontrado");
  });
  await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => servidor?.close());

test("arquivo público desce sem mandar credencial nenhuma", async () => {
  chamadas = [];
  const conteudo = await baixarArquivo(`${base}/publico.xml`);
  assert.equal(conteudo.toString("utf8"), XML);
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].auth, null, "não devia ter mandado Authorization");
});

test("se o servidor pedir credencial, tenta de novo com ela em vez de desistir", async () => {
  chamadas = [];
  const conteudo = await baixarArquivo(`${base}/protegido.xml`);
  assert.equal(conteudo.toString("utf8"), XML);
  assert.equal(chamadas.length, 2, "esperava uma tentativa sem auth e outra com");
  assert.equal(chamadas[0].auth, null);
  assert.match(chamadas[1].auth, /^Basic /);
});

test("404 vira erro com o código dentro — é o que aparece no _faltando.txt", async () => {
  chamadas = [];
  await assert.rejects(baixarArquivo(`${base}/sumiu.xml`), /HTTP 404/);
});

test("servidor pendurado não segura o pacote: estoura no tempo combinado", async () => {
  chamadas = [];
  await assert.rejects(
    baixarArquivo(`${base}/pendurado.xml`, { timeoutMs: 300 }),
    (err) => err.name === "TimeoutError"
  );
});
