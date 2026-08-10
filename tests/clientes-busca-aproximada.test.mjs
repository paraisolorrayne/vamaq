/**
 * Prova, contra Postgres de verdade, o caso que a busca de cliente do CRM
 * existe para pegar (item 1 de fix-duplicado-report.md): erro de digitação
 * no sobrenome. Antes desta entrega, `lower(c.nome) like '%termo%'` era
 * comparação por trecho literal — com "Carlos Mendez" no cadastro, digitar
 * "Carlos Mendes" devolvia zero linhas, e a tela oferecia cadastrar um
 * duplicado.
 *
 * Usa a função de verdade (clausulaBuscaNome, src/lib/clientes/busca.js —
 * pura, import relativo, mesma razão de campos.js/doc.js: repo.js importa
 * "@/lib/db" e por isso é intestável em `node --test`, onde o alias "@/"
 * não resolve) para montar a mesma cláusula que listClientes() usa, e roda
 * a consulta contra um banco descartável.
 *
 * Monta o banco com `db/aplicar-schemas.sh` (a ordem certa dos sete schemas
 * do `public` — ver o cabeçalho daquele arquivo) em vez de reaplicar cada
 * .sql à mão como os testes mais antigos desta família (clientes-schema.test.mjs
 * e vizinhos): o script é o jeito canônico agora, e usá-lo aqui prova que ele
 * funciona por fora do deploy também.
 *
 *   npm test   (usa TEST_ADMIN_URL, default postgres@localhost)
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { clausulaBuscaNome, aplicarLimite } from "../src/lib/clientes/busca.js";

const execFileAsync = promisify(execFile);

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADMIN_URL =
  process.env.TEST_ADMIN_URL || "postgres://postgres@localhost:5432/postgres";
const TEST_DB = "vamaq_clientes_busca_test";

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
  const dbUrl = urlFor(su);
  await execFileAsync("bash", [path.join(ROOT, "db", "aplicar-schemas.sh"), dbUrl]);

  pool = new pg.Pool({ connectionString: dbUrl });
});

after(async () => {
  await pool?.end();
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.end();
});

let slugSeq = 0;

async function novoCliente(nome, { ativo = true } = {}) {
  const { rows } = await pool.query(
    `insert into clientes (nome, ativo) values ($1, $2) returning id`,
    [nome, ativo]
  );
  return rows[0].id;
}

/**
 * Mesma consulta que listClientes() monta (src/lib/clientes/repo.js): usa a
 * cláusula de verdade (clausulaBuscaNome) e, opcionalmente, o mesmo `limit
 * N+1` que o repo usa para saber se cortou resultado.
 */
async function buscar(termo, { limite } = {}) {
  const nome = clausulaBuscaNome(termo, 1);
  const params = [...nome.params];
  let sql = `select c.id, c.nome from clientes c where (${nome.clause})
             order by ${nome.orderBy}, c.nome`;
  if (limite) {
    params.push(limite + 1);
    sql += ` limit $${params.length}`;
  }
  const { rows } = await pool.query(sql, params);
  return rows;
}

test("erro de digitação no sobrenome acha o cliente cadastrado", async () => {
  await novoCliente("Carlos Mendez");

  const rows = await buscar("Carlos Mendes");

  assert.ok(
    rows.some((r) => r.nome === "Carlos Mendez"),
    'busca por "Carlos Mendes" devia achar "Carlos Mendez" pelo primeiro token'
  );
});

test("primeiro token também acha homônimo com nome completo diferente", async () => {
  await novoCliente("Carlos Mendez");
  await novoCliente("Carlos Eduardo Mendes");

  const rows = await buscar("Carlos Mendes");
  const nomes = rows.map((r) => r.nome);

  assert.ok(nomes.includes("Carlos Mendez"), "não achou Carlos Mendez");
  assert.ok(nomes.includes("Carlos Eduardo Mendes"), "não achou Carlos Eduardo Mendes");
});

test("quem casa o termo inteiro vem antes de quem casa só pelo primeiro token", async () => {
  await novoCliente("Carlos Eduardo Mendes"); // só o token "carlos" casa
  await novoCliente("Carlos Mendes"); // termo inteiro casa

  const rows = await buscar("Carlos Mendes");
  const posicaoExato = rows.findIndex((r) => r.nome === "Carlos Mendes");
  const posicaoToken = rows.findIndex((r) => r.nome === "Carlos Eduardo Mendes");

  assert.ok(posicaoExato !== -1 && posicaoToken !== -1, "os dois precisam aparecer");
  assert.ok(posicaoExato < posicaoToken, "o casamento exato devia vir primeiro");
});

test("primeiro token com menos de 3 caracteres não vira busca à parte", async () => {
  // Se o token curto ("Jo") virasse uma cláusula própria (like '%jo%'), este
  // cliente apareceria por causa do "jo" escondido dentro de "Joana" — mesmo
  // sem casar o termo inteiro "jo ferreira" (que não existe literalmente no
  // nome dele). Buscar "de" ou "Jo" sozinho não pode trazer o cadastro
  // inteiro; o mesmo vale aqui dentro de um termo de duas palavras.
  await novoCliente("Maria Joana Ferreira");

  const rows = await buscar("Jo Ferreira");

  assert.equal(
    rows.some((r) => r.nome === "Maria Joana Ferreira"),
    false,
    'token curto "Jo" não deveria, sozinho, ampliar a busca'
  );
});

test("cliente inativo continua aparecendo (a busca não filtra ativo)", async () => {
  await novoCliente("Cliente Busca Inativo", { ativo: false });

  const rows = await buscar("Cliente Busca Inativo");
  assert.ok(rows.some((r) => r.nome === "Cliente Busca Inativo"));
});

test("o limit corta o resultado quando há mais homônimos que o teto", async () => {
  for (let i = 0; i < 9; i++) {
    await novoCliente(`Zeta Repetido ${i}`);
  }

  const semLimite = await buscar("Zeta Repetido");
  assert.equal(semLimite.length, 9, "sanity check: os 9 semeados batem com o termo");

  // Mesma dobradinha de listClientes() (src/lib/clientes/repo.js): busca()
  // pede `limit N+1` (aqui, 9 linhas para um teto de 8) e aplicarLimite()
  // (pura, testada isoladamente em clientes-busca.test.mjs) corta para 8 e
  // marca `.mais`. Provar as duas juntas, contra Postgres de verdade, é o
  // que prova que o limite da tela realmente vale.
  const nove = await buscar("Zeta Repetido", { limite: 8 });
  assert.equal(nove.length, 9, "buscar() pede limite+1 para o corte ter como saber que sobrou gente");

  const oito = aplicarLimite(nove, 8);
  assert.equal(oito.length, 8);
  assert.equal(oito.mais, true);
});
