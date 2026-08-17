/**
 * Contrato do schema da assinatura eletrônica, contra Postgres real.
 *
 * O que está sendo protegido aqui é UMA invariante que a tela não consegue
 * garantir sozinha: um contrato não pode estar em duas coletas de assinatura
 * ao mesmo tempo. Se estivesse, existiriam dois links válidos para o mesmo
 * papel e duas vias assinadas diferentes — e nenhuma das duas seria,
 * sozinha, "o contrato". Dois cliques rápidos no botão, ou duas abas abertas,
 * bastam para provocar isso pela tela; só o índice parcial no banco impede.
 *
 *   1. o primeiro envio é aceito;
 *   2. um segundo envio com o primeiro ainda vivo é RECUSADO;
 *   3. depois que o primeiro morre (recusado/expirado), reenviar é aceito;
 *   4. dois envios mortos coexistem — o histórico não é apagado;
 *   5. apagar o documento apaga os envios (registro de envio sem documento
 *      não é prova de nada);
 *   6. apagar o usuário mantém o envio, sem o autor;
 *   7. assinafy_document_id é único entre documentos diferentes;
 *   8. updated_at anda sozinho a cada escrita.
 *
 *   npm test   (usa TEST_ADMIN_URL, default postgres@localhost)
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADMIN_URL =
  process.env.TEST_ADMIN_URL || "postgres://postgres@localhost:5432/postgres";
const TEST_DB = "vamaq_assinatura_test";

function urlFor(user) {
  const u = new URL(ADMIN_URL);
  return `${u.protocol}//${user}@${u.hostname}:${u.port || 5432}/${TEST_DB}`;
}

let pool;

before(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const su = new URL(ADMIN_URL).username || "postgres";
  pool = new pg.Pool({ connectionString: urlFor(su) });
  for (const f of [
    "schema.sql",
    "auth-schema.sql",
    "documentos-schema.sql",
    "assinatura-schema.sql",
  ]) {
    await pool.query(await readFile(path.join(ROOT, "db", f), "utf8"));
  }
});

after(async () => {
  await pool?.end();
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.end();
});

let seq = 0;

async function novoDoc() {
  seq += 1;
  const { rows } = await pool.query(
    `insert into documentos_gerados (tipo, titulo, cliente, arquivo, tamanho)
     values ('venda','Contrato de Venda','Maria Souza',$1,1234) returning id`,
    [`2026/doc-${seq}.pdf`]
  );
  return rows[0].id;
}

async function novoUsuario(email) {
  const { rows } = await pool.query(
    `insert into users (name, email, password_hash, role)
     values ('Fulano',$1,'x','vendedor') returning id`,
    [email]
  );
  return rows[0].id;
}

async function novoEnvio(documentoId, { status = "pending_signature", userId = null } = {}) {
  seq += 1;
  const { rows } = await pool.query(
    `insert into documento_assinaturas
       (documento_id, assinafy_document_id, status, enviado_por)
     values ($1,$2,$3,$4) returning *`,
    [documentoId, `assinafy-${seq}`, status, userId]
  );
  return rows[0];
}

test("o primeiro envio é aceito", async () => {
  const d = await novoDoc();
  const e = await novoEnvio(d);
  assert.equal(e.status, "pending_signature");
  assert.deepEqual(e.signers, []);
});

test("um segundo envio com o primeiro ainda vivo é recusado", async () => {
  const d = await novoDoc();
  await novoEnvio(d, { status: "pending_signature" });
  await assert.rejects(
    () => novoEnvio(d, { status: "uploaded" }),
    /documento_assinaturas_envio_atual_idx/
  );
});

test("todos os status vivos bloqueiam um envio novo", async () => {
  for (const status of [
    "uploading",
    "uploaded",
    "metadata_processing",
    "metadata_ready",
    "pending_signature",
    "certificating",
  ]) {
    const d = await novoDoc();
    await novoEnvio(d, { status });
    await assert.rejects(
      () => novoEnvio(d),
      /documento_assinaturas_envio_atual_idx/,
      `status vivo "${status}" deveria bloquear um segundo envio`
    );
  }
});

test("depois que o primeiro morre, reenviar é aceito", async () => {
  for (const morto of ["rejected_by_signer", "expired", "rejected_by_user", "failed", "certificated"]) {
    const d = await novoDoc();
    const e = await novoEnvio(d, { status: "pending_signature" });
    await pool.query(`update documento_assinaturas set status=$2 where id=$1`, [e.id, morto]);
    // não pode estourar
    await novoEnvio(d, { status: "uploaded" });
  }
});

test("dois envios mortos coexistem — o histórico não é apagado", async () => {
  const d = await novoDoc();
  const a = await novoEnvio(d, { status: "pending_signature" });
  await pool.query(`update documento_assinaturas set status='expired' where id=$1`, [a.id]);
  const b = await novoEnvio(d, { status: "pending_signature" });
  await pool.query(`update documento_assinaturas set status='rejected_by_signer' where id=$1`, [b.id]);

  const { rows } = await pool.query(
    `select count(*)::int as n from documento_assinaturas where documento_id=$1`,
    [d]
  );
  assert.equal(rows[0].n, 2);
});

test("apagar o documento apaga os envios", async () => {
  const d = await novoDoc();
  await novoEnvio(d);
  await pool.query(`delete from documentos_gerados where id=$1`, [d]);
  const { rows } = await pool.query(
    `select count(*)::int as n from documento_assinaturas where documento_id=$1`,
    [d]
  );
  assert.equal(rows[0].n, 0);
});

test("apagar o usuário mantém o envio, sem o autor", async () => {
  const d = await novoDoc();
  const u = await novoUsuario(`vendedor-${Date.now()}@vamaqmotors.com.br`);
  const e = await novoEnvio(d, { userId: u });
  await pool.query(`delete from users where id=$1`, [u]);
  const { rows } = await pool.query(
    `select enviado_por from documento_assinaturas where id=$1`,
    [e.id]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].enviado_por, null);
});

test("assinafy_document_id é único entre documentos diferentes", async () => {
  const d1 = await novoDoc();
  const d2 = await novoDoc();
  await pool.query(
    `insert into documento_assinaturas (documento_id, assinafy_document_id, status)
     values ($1,'colisao','pending_signature')`,
    [d1]
  );
  await assert.rejects(
    () =>
      pool.query(
        `insert into documento_assinaturas (documento_id, assinafy_document_id, status)
         values ($1,'colisao','pending_signature')`,
        [d2]
      ),
    /documento_assinaturas_assinafy_document_id_key/
  );
});

test("updated_at anda sozinho a cada escrita", async () => {
  const d = await novoDoc();
  const e = await novoEnvio(d);
  // A comparação é feita DENTRO do Postgres de propósito. O driver pg entrega
  // timestamptz como Date do JavaScript, que só guarda milissegundos — um
  // insert e um update separados por microssegundos viram o mesmo Date, e o
  // teste passaria ou falharia conforme a máquina estivesse rápida naquele
  // instante. Comparar no banco preserva a precisão real da coluna.
  const { rows } = await pool.query(
    `update documento_assinaturas set status='certificated' where id=$1
     returning updated_at > created_at as avancou`,
    [e.id]
  );
  assert.equal(rows[0].avancou, true, "updated_at deveria avançar depois do update");
});
