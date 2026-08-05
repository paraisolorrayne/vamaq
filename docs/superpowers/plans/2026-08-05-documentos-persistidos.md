# Persistir os documentos gerados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Todo contrato gerado fica guardado no servidor e pode ser reaberto depois — pela lista, com busca, ou pelo dossiê do carro.

**Architecture:** O PDF continua sendo montado no navegador; o mesmo clique que baixa manda uma cópia ao servidor, que grava o arquivo em `data/documentos/` e uma linha em `documentos_gerados`. O download vem primeiro e nunca depende do arquivamento.

**Tech Stack:** Next.js 16 (App Router, Route Handlers), React 19, Postgres via `pg`, jsPDF no cliente, CSS Modules.

**Spec:** `docs/superpowers/specs/2026-08-05-documentos-persistidos-design.md`

## Global Constraints

- **Leia o guia do Next antes de escrever código**: este Next tem mudanças de API em relação ao seu treino — consulte `node_modules/next/dist/docs/` (regra do `AGENTS.md`).
- JavaScript puro (sem TypeScript), CSS Modules já existentes — sem CSS novo, sem dependência nova.
- Código, textos de tela e comentários em português, linguagem direta (a usuária é dona de loja de carros, não técnica).
- **Acesso**: páginas com `await requireRole(["admin", "vendedor", "secretaria"])`; rotas de API com `await requireApiRole(["vendedor", "secretaria"])` — `requireApiRole` já deixa `admin` passar sempre (`src/lib/auth/api.js:26`).
- **Arquivos ficam FORA de `public/`**, em `data/documentos/`, servidos só por rota autenticada — mesmo padrão de `data/vehicle-docs/`.
- **O download nunca depende do arquivamento**: o PDF baixa primeiro; falha ao guardar vira aviso, não erro bloqueante.
- **O alias `@/` não resolve em `node --test`** — módulos com teste unitário importam por caminho relativo.
- Testes: `npm test` = `node --test --test-concurrency=1 tests/*.test.mjs`; banco usa `TEST_ADMIN_URL` (default `postgres://postgres@localhost:5432/postgres`).
- Commits em português, um por task, prefixo `feat:` / `fix:` / `docs:`.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/contractTemplates.js` (modificar) | `clienteDoDocumento` — quem é a outra parte, por modelo. |
| `db/documentos-schema.sql` (criar) | Tabela `documentos_gerados`. |
| `src/lib/documentos.js` (criar) | Gravar, listar, buscar e localizar o arquivo. |
| `src/app/api/admin/documentos-gerados/route.js` (criar) | POST: recebe o PDF e grava. |
| `src/app/api/admin/documentos-gerados/[id]/arquivo/route.js` (criar) | GET: serve o PDF com login. |
| `src/lib/contractPdf.js` (modificar) | `generateContractPdf` passa a devolver o blob. |
| `src/app/admin/documentos/page.js` (modificar) | Guarda o veículo escolhido e manda a cópia. |
| `src/app/admin/documentos/gerados/page.js` + `GeradosClient.js` (criar) | Lista com busca. |
| `src/app/admin/estoque/novo/page.js` (modificar) | Bloco "Contratos gerados" no dossiê. |
| `tests/documentos-cliente.test.mjs` (criar) | `clienteDoDocumento`. |
| `tests/documentos-schema.test.mjs` (criar) | Contrato do schema. |

---

### Task 1: De quem é o documento

**Files:**
- Modify: `src/lib/contractTemplates.js`
- Test: `tests/documentos-cliente.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `clienteDoDocumento(templateId, values) -> string | null`.

Cada modelo chama a outra parte de um jeito. O mapa abaixo foi extraído dos próprios modelos: `compra-venda` → `vendedor_nome` (a Vamaq compra), `venda` → `comprador_nome` (a Vamaq vende), `consignacao` e `termo-vistoria` → `proprietario_nome`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/documentos-cliente.test.mjs`:

```js
/**
 * De quem é o documento — a outra parte, por modelo de contrato.
 * Puro: sem banco, sem rede.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { clienteDoDocumento } from "../src/lib/contractTemplates.js";

test("compra e venda: a outra parte é o vendedor", () => {
  assert.equal(
    clienteDoDocumento("compra-venda", { vendedor_nome: "João Silva", comprador_nome: "Vamaq" }),
    "João Silva"
  );
});

test("venda: a outra parte é o comprador", () => {
  assert.equal(clienteDoDocumento("venda", { comprador_nome: "Maria Souza" }), "Maria Souza");
});

test("consignação e vistoria: a outra parte é o proprietário", () => {
  assert.equal(clienteDoDocumento("consignacao", { proprietario_nome: "Carlos Lima" }), "Carlos Lima");
  assert.equal(clienteDoDocumento("termo-vistoria", { proprietario_nome: "Ana Costa" }), "Ana Costa");
});

test("devolve null quando o campo está vazio ou só com espaços", () => {
  assert.equal(clienteDoDocumento("venda", { comprador_nome: "" }), null);
  assert.equal(clienteDoDocumento("venda", { comprador_nome: "   " }), null);
  assert.equal(clienteDoDocumento("venda", {}), null);
});

test("devolve null para modelo desconhecido ou valores ausentes", () => {
  assert.equal(clienteDoDocumento("modelo-que-nao-existe", { vendedor_nome: "X" }), null);
  assert.equal(clienteDoDocumento("venda", null), null);
  assert.equal(clienteDoDocumento(null, {}), null);
});

test("apara espaços em volta do nome", () => {
  assert.equal(clienteDoDocumento("venda", { comprador_nome: "  Maria Souza  " }), "Maria Souza");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/documentos-cliente.test.mjs`
Expected: FAIL — `clienteDoDocumento is not a function` (o export ainda não existe).

- [ ] **Step 3: Implementar**

Acrescentar ao final de `src/lib/contractTemplates.js`:

```js
/**
 * Quem é a "outra parte" do documento — o cliente, do ponto de vista da Vamaq.
 * Cada modelo chama por um nome: na compra é o vendedor, na venda é o
 * comprador, na consignação e na vistoria é o proprietário do carro.
 *
 * Puro de propósito (sem I/O): é usado tanto na tela quanto no teste, que roda
 * em `node --test`, onde o alias "@/" não resolve.
 */
const CAMPO_CLIENTE = {
  "compra-venda": "vendedor_nome",
  venda: "comprador_nome",
  consignacao: "proprietario_nome",
  "termo-vistoria": "proprietario_nome",
};

export function clienteDoDocumento(templateId, values) {
  const campo = CAMPO_CLIENTE[templateId];
  if (!campo || !values) return null;
  const nome = String(values[campo] ?? "").trim();
  return nome || null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/documentos-cliente.test.mjs`
Expected: PASS — 6 testes.

- [ ] **Step 5: Rodar a suíte e commitar**

Run: `npm test` (os 49 anteriores continuam verdes)

```bash
git add src/lib/contractTemplates.js tests/documentos-cliente.test.mjs
git commit -m "feat: identifica a outra parte do documento por modelo"
```

---

### Task 2: Schema dos documentos guardados

**Files:**
- Create: `db/documentos-schema.sql`
- Test: `tests/documentos-schema.test.mjs`

**Interfaces:**
- Consumes: `vehicles` e `users`; `set_updated_at()` não é usado (a tabela não tem `updated_at`).
- Produces: tabela `documentos_gerados`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/documentos-schema.test.mjs`:

```js
/**
 * Contrato do schema dos documentos guardados, contra Postgres real.
 *
 *   1. apagar o veículo NÃO apaga o contrato (vira vehicle_id nulo);
 *   2. apagar o usuário NÃO apaga o contrato (vira criado_por nulo);
 *   3. documento sem veículo é aceito;
 *   4. tipo é restrito aos quatro modelos.
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
const TEST_DB = "vamaq_docs_test";

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
  for (const f of ["schema.sql", "auth-schema.sql", "documentos-schema.sql"]) {
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

async function novoVeiculo(slug) {
  const { rows } = await pool.query(
    `insert into vehicles (slug, brand, model, year, price)
     values ($1,'Audi','Q5',2022,200000) returning id`,
    [slug]
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

async function novoDoc({ vehicleId = null, userId = null, tipo = "venda", arquivo = "2026/a.pdf" }) {
  const { rows } = await pool.query(
    `insert into documentos_gerados (tipo, titulo, cliente, vehicle_id, arquivo, tamanho, criado_por)
     values ($1,'Contrato de Venda','Maria Souza',$2,$3,1234,$4) returning id`,
    [tipo, vehicleId, arquivo, userId]
  );
  return rows[0].id;
}

test("apagar o veículo mantém o contrato, sem o vínculo", async () => {
  const v = await novoVeiculo("q5-doc");
  const d = await novoDoc({ vehicleId: v, arquivo: "2026/b.pdf" });
  await pool.query(`delete from vehicles where id=$1`, [v]);
  const { rows } = await pool.query(`select vehicle_id from documentos_gerados where id=$1`, [d]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].vehicle_id, null);
});

test("apagar o usuário mantém o contrato, sem o autor", async () => {
  const u = await novoUsuario("vendedor@vamaqmotors.com.br");
  const d = await novoDoc({ userId: u, arquivo: "2026/c.pdf" });
  await pool.query(`delete from users where id=$1`, [u]);
  const { rows } = await pool.query(`select criado_por from documentos_gerados where id=$1`, [d]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].criado_por, null);
});

test("documento sem veículo é aceito", async () => {
  const d = await novoDoc({ arquivo: "2026/d.pdf" });
  const { rows } = await pool.query(`select vehicle_id from documentos_gerados where id=$1`, [d]);
  assert.equal(rows[0].vehicle_id, null);
});

test("tipo é restrito aos quatro modelos", async () => {
  for (const t of ["compra-venda", "venda", "consignacao", "termo-vistoria"]) {
    await novoDoc({ tipo: t, arquivo: `2026/${t}.pdf` });
  }
  await assert.rejects(
    () => novoDoc({ tipo: "qualquer-coisa", arquivo: "2026/x.pdf" }),
    /documento_tipo_check/
  );
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/documentos-schema.test.mjs`
Expected: FAIL — `ENOENT ... db/documentos-schema.sql`

- [ ] **Step 3: Implementar o schema**

Criar `db/documentos-schema.sql`:

```sql
-- ============================================================================
-- VAMAQ MOTORS — documentos gerados (contratos) guardados para consulta.
--
-- O PDF fica em data/documentos/<ano>/<uuid>.pdf, FORA de public/, servido só
-- com login. Aqui ficam os metadados que permitem achar o documento depois.
--
-- Contrato é PROVA: apagar o veículo ou o usuário NÃO apaga o documento —
-- por isso `on delete set null` nos dois vínculos, nunca cascade.
--
-- Aplicar:  psql "$DATABASE_URL" -f db/documentos-schema.sql   (re-aplicável)
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists documentos_gerados (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null,
  titulo      text not null,
  cliente     text,                        -- a outra parte; null se não identificada
  vehicle_id  uuid references vehicles(id) on delete set null,
  arquivo     text not null,               -- caminho relativo dentro de data/documentos
  tamanho     integer,
  criado_por  uuid references users(id) on delete set null,
  created_at  timestamptz not null default now(),

  constraint documento_tipo_check
    check (tipo in ('compra-venda','venda','consignacao','termo-vistoria'))
);

create index if not exists documentos_gerados_data_idx
  on documentos_gerados(created_at desc);
create index if not exists documentos_gerados_veiculo_idx
  on documentos_gerados(vehicle_id) where vehicle_id is not null;
create index if not exists documentos_gerados_cliente_idx
  on documentos_gerados(lower(cliente));
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/documentos-schema.test.mjs`
Expected: PASS — 4 testes.

- [ ] **Step 5: Conferir a idempotência**

Run: `node --test tests/documentos-schema.test.mjs && node --test tests/documentos-schema.test.mjs`
Expected: PASS nas duas execuções.

- [ ] **Step 6: Commitar**

```bash
git add db/documentos-schema.sql tests/documentos-schema.test.mjs
git commit -m "feat: schema dos documentos gerados"
```

---

### Task 3: Camada de dados e rotas

**Files:**
- Create: `src/lib/documentos.js`
- Create: `src/app/api/admin/documentos-gerados/route.js`
- Create: `src/app/api/admin/documentos-gerados/[id]/arquivo/route.js`

**Interfaces:**
- Consumes: `query` de `@/lib/db`; `requireApiRole` de `@/lib/auth/api`.
- Produces:
  - `salvarDocumento({ tipo, titulo, cliente, vehicleId, criadoPor, buffer }) -> { documento } | { error }`
  - `listDocumentos({ busca } = {}) -> Array`
  - `listDocumentosDoVeiculo(vehicleId) -> Array`
  - `getDocumentoArquivo(id) -> { caminhoAbsoluto, titulo } | null`
  - `POST /api/admin/documentos-gerados` (multipart: `file`, `tipo`, `titulo`, `cliente`, `vehicleId`)
  - `GET /api/admin/documentos-gerados/[id]/arquivo`

- [ ] **Step 1: Camada de dados**

Criar `src/lib/documentos.js`:

```js
/**
 * Documentos gerados (contratos) guardados para consulta futura.
 *
 * O PDF vive em data/documentos/<ano>/<uuid>.pdf — fora de public/, mesmo
 * padrão de data/vehicle-docs/. Server-only.
 */
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { query } from "@/lib/db";

const DOCS_ROOT = path.join(process.cwd(), "data", "documentos");
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB — um contrato em PDF vetorial tem poucos KB
const TIPOS = ["compra-venda", "venda", "consignacao", "termo-vistoria"];

export async function salvarDocumento({ tipo, titulo, cliente, vehicleId, criadoPor, buffer }) {
  if (!TIPOS.includes(tipo)) return { error: "Tipo de documento desconhecido." };
  if (!titulo) return { error: "Documento sem título." };
  if (!buffer?.length) return { error: "Arquivo vazio." };
  if (buffer.length > MAX_BYTES) return { error: "Arquivo acima de 20 MB." };

  const ano = String(new Date().getFullYear());
  const relativo = path.join(ano, `${uuidv4()}.pdf`);
  await fs.mkdir(path.join(DOCS_ROOT, ano), { recursive: true });
  await fs.writeFile(path.join(DOCS_ROOT, relativo), buffer);

  const { rows } = await query(
    `insert into documentos_gerados (tipo, titulo, cliente, vehicle_id, arquivo, tamanho, criado_por)
     values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [tipo, titulo, cliente || null, vehicleId || null, relativo, buffer.length, criadoPor || null]
  );
  return { documento: rows[0] };
}

const SELECT = `
  select d.*, v.brand, v.model, v.year, v.placa, u.name as criado_por_nome
    from documentos_gerados d
    left join vehicles v on v.id = d.vehicle_id
    left join users u on u.id = d.criado_por
`;

export async function listDocumentos({ busca } = {}) {
  const termo = String(busca || "").trim();
  const { rows } = termo
    ? await query(
        `${SELECT} where lower(d.cliente) like lower($1) or lower(coalesce(v.placa,'')) like lower($1)
         order by d.created_at desc`,
        [`%${termo}%`]
      )
    : await query(`${SELECT} order by d.created_at desc`);
  return rows;
}

export async function listDocumentosDoVeiculo(vehicleId) {
  const { rows } = await query(
    `${SELECT} where d.vehicle_id = $1 order by d.created_at desc`,
    [vehicleId]
  );
  return rows;
}

/** Caminho absoluto do PDF, ou null se a linha ou o arquivo não existirem. */
export async function getDocumentoArquivo(id) {
  const { rows } = await query(
    `select titulo, arquivo from documentos_gerados where id = $1`,
    [id]
  );
  if (!rows.length) return null;
  const caminhoAbsoluto = path.join(DOCS_ROOT, rows[0].arquivo);
  try {
    await fs.access(caminhoAbsoluto);
  } catch {
    return null; // linha no banco, arquivo sumiu do disco
  }
  return { caminhoAbsoluto, titulo: rows[0].titulo };
}
```

- [ ] **Step 2: Rota que grava**

Criar `src/app/api/admin/documentos-gerados/route.js`:

```js
import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { salvarDocumento, listDocumentos } from "@/lib/documentos";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireApiRole(["vendedor", "secretaria"]);
  if (auth.error) return auth.error;
  const busca = new URL(request.url).searchParams.get("busca") || "";
  return NextResponse.json({ documentos: await listDocumentos({ busca }) });
}

export async function POST(request) {
  const auth = await requireApiRole(["vendedor", "secretaria"]);
  if (auth.error) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }
    const res = await salvarDocumento({
      tipo: String(formData.get("tipo") || ""),
      titulo: String(formData.get("titulo") || "").slice(0, 200),
      cliente: String(formData.get("cliente") || "").slice(0, 200) || null,
      vehicleId: formData.get("vehicleId") || null,
      criadoPor: auth.user.id,
      buffer: Buffer.from(await file.arrayBuffer()),
    });
    if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true, id: res.documento.id });
  } catch (err) {
    console.error("Falha ao guardar documento:", err);
    return NextResponse.json({ error: "Falha ao guardar o documento" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Rota que serve o arquivo**

Criar `src/app/api/admin/documentos-gerados/[id]/arquivo/route.js`:

```js
import fs from "fs/promises";
import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { getDocumentoArquivo } from "@/lib/documentos";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const auth = await requireApiRole(["vendedor", "secretaria"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const doc = await getDocumentoArquivo(id);
  if (!doc) {
    return NextResponse.json(
      { error: "Documento não encontrado ou arquivo indisponível" },
      { status: 404 }
    );
  }
  const arquivo = await fs.readFile(doc.caminhoAbsoluto);
  return new NextResponse(arquivo, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.titulo.replace(/[^\w.-]+/g, "_")}.pdf"`,
    },
  });
}
```

- [ ] **Step 4: Verificar**

Run: `npm test && npm run build`
Expected: **59 testes verdes** (49 que já existiam + 6 da Task 1 + 4 da Task 2), build sem erro.

- [ ] **Step 5: Commitar**

```bash
git add src/lib/documentos.js src/app/api/admin/documentos-gerados
git commit -m "feat: guarda e serve os documentos gerados"
```

---

### Task 4: Guardar no momento em que o PDF é gerado

**Files:**
- Modify: `src/lib/contractPdf.js`
- Modify: `src/app/admin/documentos/page.js`

**Interfaces:**
- Consumes: `clienteDoDocumento` (Task 1); `POST /api/admin/documentos-gerados` (Task 3).
- Produces: nada para tasks seguintes.

- [ ] **Step 1: `generateContractPdf` devolve o blob**

Em `src/lib/contractPdf.js`, a função hoje monta e salva. Passa a devolver o blob, sem mudar o comportamento de download:

```js
export async function generateContractPdf(preview) {
  const doc = await buildContractDoc(preview);
  doc.save(`${preview.title.replace(/\s+/g, "_")}.pdf`);
  // Devolve o mesmo PDF já montado, para a tela guardar uma cópia no servidor
  // sem precisar montar de novo.
  return doc.output("blob");
}
```

- [ ] **Step 2: Guardar o veículo escolhido**

Em `src/app/admin/documentos/page.js`, o seletor de veículo hoje só chama `fillFromVehicle(e.target.value)` e o id se perde. Acrescente um estado e grave nele **apenas quando o preenchimento for do veículo principal** (`prefix === "veiculo"`), não o da troca:

```js
  const [vehicleIdSel, setVehicleIdSel] = useState("");
```

Em `fillFromVehicle(vehicleId, prefix = "veiculo")`, logo no início:

```js
    if (prefix === "veiculo") setVehicleIdSel(vehicleId || "");
```

- [ ] **Step 3: Mandar a cópia depois do download**

Ainda em `page.js`, no `handleDownloadPdf`, **depois** do download bem-sucedido e antes do descarte do rascunho, acrescente o envio. Importe `clienteDoDocumento` de `@/lib/contractTemplates` junto do import de `DEFAULT_TEMPLATES` que já existe, e acrescente um estado de aviso:

```js
  const [avisoCopia, setAvisoCopia] = useState(null);
```

```js
  async function handleDownloadPdf() {
    if (!preview) return;
    let blob;
    try {
      blob = await generateContractPdf(preview);
    } catch (err) {
      alert("Erro ao gerar PDF: " + err.message);
      return;
    }

    // O download já aconteceu. Guardar a cópia no servidor é o passo seguinte e
    // NUNCA pode derrubar a geração do contrato — falhou, o operador é avisado
    // e segue com o arquivo na mão.
    setAvisoCopia(null);
    try {
      const fd = new FormData();
      fd.set("file", blob, "contrato.pdf");
      fd.set("tipo", selectedTemplate.id);
      fd.set("titulo", preview.title);
      const cliente = clienteDoDocumento(selectedTemplate.id, values);
      if (cliente) fd.set("cliente", cliente);
      if (vehicleIdSel) fd.set("vehicleId", vehicleIdSel);
      const res = await fetch("/api/admin/documentos-gerados", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
    } catch {
      setAvisoCopia(
        "O PDF foi baixado, mas não deu para guardar a cópia no sistema. Guarde o arquivo e avise o suporte."
      );
    }
```

Depois desse bloco, o descarte do rascunho de uso único que já existe no final da função continua exatamente como está — não mexa nele.

E renderize o aviso perto do botão de download, no padrão de erro que a tela já usa:

```jsx
      {avisoCopia && (
        <p style={{ color: "#a16207", fontSize: "0.85rem" }}>{avisoCopia}</p>
      )}
```

- [ ] **Step 4: Verificar**

Run: `npm test && npm run build`
Expected: testes verdes, build sem erro.

Você **não tem navegador**: não faça verificação visual e não invente que fez.

- [ ] **Step 5: Commitar**

```bash
git add src/lib/contractPdf.js src/app/admin/documentos/page.js
git commit -m "feat: guarda uma cópia do contrato ao gerar o PDF"
```

---

### Task 5: Tela de documentos guardados

**Files:**
- Create: `src/app/admin/documentos/gerados/page.js`
- Create: `src/app/admin/documentos/gerados/GeradosClient.js`
- Modify: `src/app/admin/documentos/page.js` (atalho)

**Interfaces:**
- Consumes: `listDocumentos` (Task 3); `requireRole` de `@/lib/auth/dal`.
- Produces: rota `/admin/documentos/gerados`.

- [ ] **Step 1: Página**

Criar `src/app/admin/documentos/gerados/page.js`:

```js
import { requireRole } from "@/lib/auth/dal";
import { listDocumentos } from "@/lib/documentos";
import GeradosClient from "./GeradosClient";

export const metadata = {
  title: "Documentos gerados — Vamaq Motors",
  robots: { index: false, follow: false },
};

export default async function GeradosPage() {
  await requireRole(["admin", "vendedor", "secretaria"]);
  const documentos = await listDocumentos();
  return <GeradosClient documentos={documentos} />;
}
```

- [ ] **Step 2: Client**

Criar `src/app/admin/documentos/gerados/GeradosClient.js`. **Leia `src/app/admin/funcionarios/FuncionariosClient.js` primeiro** e siga a mesma estrutura: `"use client"`, cabeçalho `styles.pageHeader` + `<h1 className={styles.pageTitle}>` + `styles.pageSubtitle`, tabela em `styles.tableWrap`. Requisitos:

- Campo de busca no topo (`styles.formInput`), filtrando **na própria tela** sobre a lista recebida (a lista da Vamaq é pequena; não precisa ir ao servidor a cada tecla). Busca casa com cliente **ou** placa, sem diferenciar maiúsculas.
- Colunas: Data (`toLocaleDateString("pt-BR")`), Tipo (rótulo amigável — "Compra e venda", "Venda", "Consignação", "Termo de vistoria"), Cliente (ou "—"), Veículo (`brand model year` + placa, ou "—"), Gerado por, e um link **Abrir** para `/api/admin/documentos-gerados/<id>/arquivo`, com `target="_blank"`.
- Lista vazia: "Nenhum documento guardado ainda." Busca sem resultado: "Nenhum documento encontrado para essa busca."

- [ ] **Step 3: Atalho na tela de Documentos**

Em `src/app/admin/documentos/page.js`, acrescente perto do cabeçalho um link para `/admin/documentos/gerados` com o texto **"Documentos gerados"**, no padrão dos links de ação que a tela já usa.

- [ ] **Step 4: Verificar**

Run: `npm test && npm run build`
Expected: testes verdes, build sem erro. Verificação visual fica para o controlador.

- [ ] **Step 5: Commitar**

```bash
git add src/app/admin/documentos
git commit -m "feat: tela de documentos guardados com busca"
```

---

### Task 6: Contratos no dossiê do veículo

**Files:**
- Modify: `src/app/admin/estoque/novo/page.js`

**Interfaces:**
- Consumes: `GET /api/admin/documentos-gerados` (Task 3) — filtrando pelo veículo no cliente, ou uma chamada dedicada se preferir.
- Produces: nada.

- [ ] **Step 1: Buscar os contratos do veículo**

`src/app/admin/estoque/novo/page.js` é a tela de cadastro/edição do veículo e já tem a seção de **documentos anexados**. Quando estiver em modo edição (há `id`), busque também os contratos daquele carro e mostre um bloco **somente leitura** logo abaixo dos anexos.

Use a rota que já existe: `GET /api/admin/documentos-gerados` devolve todos com `vehicle_id`; filtre pelo id do veículo em edição. (Se preferir uma chamada dedicada, acrescente o parâmetro `vehicleId` na rota — nesse caso diga no relatório.)

- [ ] **Step 2: Renderizar o bloco**

Título **"Contratos gerados"**, com a legenda "Gerados pelo sistema — não são os documentos digitalizados acima." Para cada um: data, tipo, cliente e link **Abrir**. Sem nada: "Nenhum contrato gerado para este veículo."

Siga as classes que a própria tela já usa na seção de documentos, sem CSS novo.

- [ ] **Step 3: Verificar**

Run: `npm test && npm run build`
Expected: testes verdes, build sem erro. Verificação visual fica para o controlador.

- [ ] **Step 4: Commitar**

```bash
git add src/app/admin/estoque/novo/page.js
git commit -m "feat: contratos gerados aparecem no dossiê do veículo"
```

---

### Task 7: Backup da pasta `data/`

**Files:**
- Modify: `docs/RUNBOOK-BACKUP.md`
- Modify (na VPS): `/usr/local/bin/backup-vamaq.sh`

Esta task **não é para subagente**: mexe no script que roda em produção. Fica com o controlador e a Lorrayne.

- [ ] **Step 1: Acrescentar o tar de `data/`**

O script hoje faz `pg_dump` do banco e um `tar` de `public/images/vehicles`. Acrescente um terceiro artefato, `dados-<data>.tar.gz`, com a pasta `data/` inteira — ela guarda os documentos digitalizados dos veículos **e**, a partir desta entrega, os contratos gerados. Mesma retenção dos demais (`RETAIN`), mesma linha de log com o tamanho.

- [ ] **Step 2: Rodar uma vez e conferir**

Rodar o script à mão, conferir que o `dados-<data>.tar.gz` aparece em `/var/backups/vamaq` com tamanho plausível, e listar o conteúdo (`tar -tzf`) para ver `vehicle-docs/` e, depois do primeiro contrato, `documentos/`.

- [ ] **Step 3: Atualizar o runbook**

Em `docs/RUNBOOK-BACKUP.md`, documentar o artefato novo e **o passo de restauração** dele, ao lado dos que já existem.

```bash
git add docs/RUNBOOK-BACKUP.md
git commit -m "docs: backup passa a cobrir a pasta data/"
```

---

### Task 8: Deploy

- [ ] **Step 1: Subir e aplicar o schema antes do build**

```bash
git push origin main
ssh -i ~/.ssh/vamaq_vps root@185.197.194.18
cd /var/www/vamaq && git pull origin main
psql "$DATABASE_URL" -f db/documentos-schema.sql
npm install && npm run build && pm2 restart vamaq
```

- [ ] **Step 2: Conferir**

Gerar um contrato pelo painel, ver aparecer em `/admin/documentos/gerados`, abrir o PDF, e conferir que o arquivo existe em `/var/www/vamaq/data/documentos/<ano>/`.

---

## Notas de revisão

- **Cobertura da spec:** cliente por modelo (Task 1), schema com os dois `on delete set null` (Task 2), gravação e leitura autenticada (Task 3), captura no momento da geração com o download protegido (Task 4), lista com busca (Task 5), bloco no dossiê (Task 6), backup (Task 7), deploy (Task 8).
- **Sem teste automatizado de UI:** não existe harness de componente React no projeto. O que é crítico e silencioso — quem é o cliente do documento e o comportamento do banco ao apagar veículo/usuário — está coberto por teste puro e de banco. As telas são verificadas por build mais roteiro no navegador.
- **Fora de escopo, por decisão:** apagar documento pela tela, versionar contrato, assinatura eletrônica.
