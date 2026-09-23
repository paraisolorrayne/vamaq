/**
 * Rota que entrega a foto de veículo que o Next não conhece
 * (src/app/images/vehicles/[arquivo]/route.js).
 *
 * O defeito (21/09/2026): o `next start` lista `public/` UMA vez, na subida
 * do processo. Foto enviada pelo painel depois disso não existe para o Next.
 * O nginx entrega o arquivo cru direto do disco, então a URL respondia 200 e
 * parecia tudo certo — mas o otimizador (`/_next/image`) busca a foto por
 * dentro do Next, recebia a página 404 em HTML e respondia 400 "The requested
 * resource isn't a valid image". Todo carro cadastrado depois do último
 * restart ficava sem foto no site, até o deploy seguinte "consertar" sozinho.
 *
 * A rota só é alcançada quando o arquivo NÃO está na lista da subida (o Next
 * consulta `public/` antes das rotas), então ela cobre exatamente o buraco.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./tests/helpers/mock-session-loader.mjs", pathToFileURL("./"));

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const { GET } = await import("../src/app/images/vehicles/[arquivo]/route.js");

const DIR = path.join(process.cwd(), "public", "images", "vehicles");
const NOME = "00000000-0000-4000-8000-00000000f070.webp";
const CONTEUDO = Buffer.from("RIFF....WEBPfoto-de-teste");

fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(path.join(DIR, NOME), CONTEUDO);
after(() => fs.rmSync(path.join(DIR, NOME), { force: true }));

function pedir(arquivo) {
  return GET(new Request(`http://localhost/images/vehicles/${arquivo}`), {
    params: Promise.resolve({ arquivo }),
  });
}

test("entrega a foto que está no disco, como imagem", async () => {
  const res = await pedir(NOME);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/webp");
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), CONTEUDO);
});

test("foto que não existe responde 404", async () => {
  const res = await pedir("00000000-0000-4000-8000-000000000000.webp");
  assert.equal(res.status, 404);
});

test("nome fora do formato do upload responde 404 sem tocar no disco", async () => {
  for (const arquivo of ["../../../.env.local", "..%2F..%2F.env.local", "foto.png", ".webp", ""]) {
    const res = await pedir(arquivo);
    assert.equal(res.status, 404, arquivo);
  }
});
