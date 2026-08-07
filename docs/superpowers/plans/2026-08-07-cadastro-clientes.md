# Cadastro de clientes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um cadastro de clientes no painel que preenche contrato e NF-e sozinho e responde "quais carros passaram por essa pessoa".

**Architecture:** Tabela `clientes` no schema `public` (o schema `fin` tem role e pool próprios e é inalcançável pelo pool do app), mais uma tabela de vínculo `cliente_veiculos` alimentada automaticamente quando um contrato é gerado ou uma nota é emitida com cliente selecionado. A lógica que dá para testar sem tela (normalização de documento, montagem de endereço, mapeamento cliente→campos do template) vive em módulos puros sem imports; o resto é tela e rota.

**Tech Stack:** Next.js 16 (App Router, Server Components + Server Actions), React 19, Postgres via `pg`, CSS Modules (`admin.module.css`), testes em `node:test`.

**Spec:** `docs/superpowers/specs/2026-08-07-cadastro-clientes-design.md`

## Global Constraints

- **Este Next.js não é o do seu treino.** Antes de escrever código de rota, página ou action, leia o guia correspondente em `node_modules/next/dist/docs/`. `params` é assíncrono (`const { id } = await params`). Componente que usa `useSearchParams` precisa estar dentro de `<Suspense>`.
- **O alias `@/` NÃO resolve em `node --test`.** Todo módulo com teste próprio deve ser puro: sem nenhum `import`. Mesmo padrão de `src/lib/rh/cpf.js`, `src/lib/fiscal/payload.js`, `src/lib/documentosCliente.js`, `src/lib/buscaVeiculo.js`.
- **Não crie classes novas em `admin.module.css`.** Use as existentes (`card`, `formGrid`, `formGroup`, `formGroupFull`, `formLabel`, `formInput`, `formSelect`, `formActions`, `table`, `tableWrap`, `tableActions`, `btnPrimary`, `btnSecondary`, `btnDanger`, `btnSmall`, `badgeSuccess`, `badgeWarning`, `pageHeader`, `pageTitle`, `pageSubtitle`, `backLinkContent`, `emptyState`). Ajustes pontuais vão em `style={{...}}` inline, como o resto do painel já faz.
- **`formGroupFull` nunca vai sozinho** — sempre `` className={`${styles.formGroup} ${styles.formGroupFull}`} ``. Sozinho ele não empilha e quebra o layout.
- **Toda cópia de tela em português do Brasil**, no tom do painel (frases curtas, sem jargão).
- **Documento (CPF/CNPJ) é sempre gravado só com dígitos** e exibido formatado.
- **Guarda de API:** `const auth = await requireApiRole([...]); if (auth.error) return auth.error;` no início de cada handler, de `@/lib/auth/api`.
- **Leitura x escrita de cliente têm papéis diferentes:** ler/buscar → `["secretaria", "financeiro", "vendedor"]`; criar/editar/apagar e mexer em vínculo → `["secretaria", "financeiro"]`. (`admin` passa em tudo, pela própria `requireApiRole`.)
- **Rodar a suíte inteira** (`npm test`) e `npm run build` antes de commitar cada task. A suíte tem 64 testes antes desta entrega.
- Commits em português, no formato `feat:`/`fix:`/`test:` como o histórico do repo.

---

### Task 1: Módulos puros de cliente (documento, endereço, prefill)

**Files:**
- Create: `src/lib/clientes/doc.js`
- Create: `src/lib/clientes/endereco.js`
- Create: `src/lib/clientes/prefill.js`
- Test: `tests/clientes-doc.test.js`
- Test: `tests/clientes-endereco.test.js`
- Test: `tests/clientes-prefill.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `doc.js`: `normalizaDoc(v) -> string`, `tipoPorDoc(doc) -> "pf"|"pj"|null`, `formataDoc(doc) -> string`, `docValido(doc) -> boolean`
  - `endereco.js`: `enderecoEmUmaLinha(cliente) -> string`
  - `prefill.js`: `papelPorTemplate(templateId) -> "comprou"|"vendeu"|"consignou"|null`, `camposDoTemplate(templateId, cliente) -> object`, `destinatarioDoCliente(cliente) -> object`

Consulte `tests/` para o estilo dos testes existentes (`node:test`, `assert/strict`).

- [ ] **Step 1: Escrever os testes de `doc.js`**

`tests/clientes-doc.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizaDoc, tipoPorDoc, formataDoc, docValido } from "../src/lib/clientes/doc.js";

test("normalizaDoc deixa só dígitos", () => {
  assert.equal(normalizaDoc("123.456.789-00"), "12345678900");
  assert.equal(normalizaDoc("12.345.678/0001-90"), "12345678000190");
  assert.equal(normalizaDoc("  123 456 "), "123456");
});

test("normalizaDoc aceita vazio, null e undefined sem quebrar", () => {
  assert.equal(normalizaDoc(""), "");
  assert.equal(normalizaDoc(null), "");
  assert.equal(normalizaDoc(undefined), "");
});

test("tipoPorDoc: 11 dígitos é pf, 14 é pj, o resto é null", () => {
  assert.equal(tipoPorDoc("12345678900"), "pf");
  assert.equal(tipoPorDoc("12345678000190"), "pj");
  assert.equal(tipoPorDoc("123"), null);
  assert.equal(tipoPorDoc(""), null);
});

test("tipoPorDoc normaliza antes de decidir", () => {
  assert.equal(tipoPorDoc("123.456.789-00"), "pf");
});

test("formataDoc aplica a máscara certa e devolve cru o que não é CPF nem CNPJ", () => {
  assert.equal(formataDoc("12345678900"), "123.456.789-00");
  assert.equal(formataDoc("12345678000190"), "12.345.678/0001-90");
  assert.equal(formataDoc("123"), "123");
  assert.equal(formataDoc(""), "");
});

test("docValido só aceita 11 ou 14 dígitos", () => {
  assert.equal(docValido("123.456.789-00"), true);
  assert.equal(docValido("12345678000190"), true);
  assert.equal(docValido("1234567890"), false);
  assert.equal(docValido(""), false);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/clientes-doc.test.js` (ou `npm test`)
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Escrever `src/lib/clientes/doc.js`**

```js
/**
 * CPF/CNPJ do cliente: normalização, tipo e máscara.
 *
 * Puro de propósito (sem I/O e sem imports): é usado na tela, na API e no
 * teste, que roda em `node --test`, onde o alias "@/" não resolve.
 *
 * O documento é gravado SÓ COM DÍGITOS. Sem isso, "123.456.789-00" e
 * "12345678900" viram dois cadastros da mesma pessoa.
 */

export function normalizaDoc(valor) {
  return String(valor ?? "").replace(/\D/g, "");
}

export function tipoPorDoc(valor) {
  const d = normalizaDoc(valor);
  if (d.length === 11) return "pf";
  if (d.length === 14) return "pj";
  return null;
}

export function docValido(valor) {
  return tipoPorDoc(valor) !== null;
}

export function formataDoc(valor) {
  const d = normalizaDoc(valor);
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return d;
}
```

Nota: não validamos dígito verificador. O cadastro aceita o que o operador tem na mão; quem barra documento inválido de verdade é a SEFAZ, na emissão.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS, sem quebrar nenhum dos 64 testes existentes.

- [ ] **Step 5: Escrever os testes de `endereco.js`**

`tests/clientes-endereco.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { enderecoEmUmaLinha } from "../src/lib/clientes/endereco.js";

test("endereço completo vira uma linha legível", () => {
  const linha = enderecoEmUmaLinha({
    logradouro: "Rua das Flores",
    numero: "120",
    complemento: "sala 3",
    bairro: "Centro",
    municipio: "Uberlândia",
    uf: "MG",
    cep: "38400-100",
  });
  assert.equal(linha, "Rua das Flores, 120, sala 3, Centro, Uberlândia/MG, CEP 38400-100");
});

test("partes vazias somem sem deixar vírgula solta", () => {
  const linha = enderecoEmUmaLinha({
    logradouro: "Rua das Flores",
    numero: "120",
    municipio: "Uberlândia",
    uf: "MG",
  });
  assert.equal(linha, "Rua das Flores, 120, Uberlândia/MG");
});

test("só município e UF", () => {
  assert.equal(enderecoEmUmaLinha({ municipio: "Uberlândia", uf: "MG" }), "Uberlândia/MG");
});

test("município sem UF, e UF sem município", () => {
  assert.equal(enderecoEmUmaLinha({ municipio: "Uberlândia" }), "Uberlândia");
  assert.equal(enderecoEmUmaLinha({ uf: "MG" }), "MG");
});

test("cliente vazio, null e sem nenhum campo de endereço devolvem string vazia", () => {
  assert.equal(enderecoEmUmaLinha({}), "");
  assert.equal(enderecoEmUmaLinha(null), "");
  assert.equal(enderecoEmUmaLinha({ nome: "Fulano" }), "");
});

test("espaços em branco não contam como preenchido", () => {
  assert.equal(enderecoEmUmaLinha({ logradouro: "   ", municipio: "Uberlândia" }), "Uberlândia");
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `enderecoEmUmaLinha` não existe.

- [ ] **Step 7: Escrever `src/lib/clientes/endereco.js`**

```js
/**
 * Endereço do cliente em uma linha só — é assim que o contrato pede.
 *
 * Puro de propósito (sem imports): o teste roda em `node --test`, onde "@/"
 * não resolve. O cadastro guarda o endereço em partes porque a NF-e exige
 * campo a campo; o contrato recebe a linha montada a partir delas.
 */

function limpo(valor) {
  return String(valor ?? "").trim();
}

export function enderecoEmUmaLinha(cliente) {
  if (!cliente) return "";
  const c = cliente;
  const cidadeUf = [limpo(c.municipio), limpo(c.uf)].filter(Boolean).join("/");
  const cep = limpo(c.cep);
  return [
    limpo(c.logradouro),
    limpo(c.numero),
    limpo(c.complemento),
    limpo(c.bairro),
    cidadeUf,
    cep ? `CEP ${cep}` : "",
  ]
    .filter(Boolean)
    .join(", ");
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Escrever os testes de `prefill.js`**

`tests/clientes-prefill.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  papelPorTemplate,
  prefixoDoTemplate,
  camposDoTemplate,
  destinatarioDoCliente,
} from "../src/lib/clientes/prefill.js";

const CLIENTE_PF = {
  nome: "Carlos Teste",
  tipo: "pf",
  doc: "12345678900",
  cnh: "01234567890",
  cnh_categoria: "B",
  telefone: "(34) 99999-0000",
  email: "carlos@exemplo.com",
  logradouro: "Rua das Flores",
  numero: "120",
  bairro: "Centro",
  municipio: "Uberlândia",
  uf: "MG",
  cep: "38400-100",
};

const CLIENTE_PJ = {
  nome: "Transportes Teste LTDA",
  tipo: "pj",
  doc: "12345678000190",
  representante_nome: "Ana Representante",
  representante_cpf: "98765432100",
  municipio: "Uberlândia",
  uf: "MG",
};

test("papelPorTemplate mapeia cada modelo", () => {
  assert.equal(papelPorTemplate("compra-venda"), "vendeu");
  assert.equal(papelPorTemplate("venda"), "comprou");
  assert.equal(papelPorTemplate("consignacao"), "consignou");
  assert.equal(papelPorTemplate("termo-vistoria"), "consignou");
});

test("papelPorTemplate devolve null para modelo desconhecido ou vazio", () => {
  assert.equal(papelPorTemplate("outro-qualquer"), null);
  assert.equal(papelPorTemplate(""), null);
  assert.equal(papelPorTemplate(null), null);
});

test("prefixoDoTemplate devolve o prefixo dos campos daquele modelo", () => {
  assert.equal(prefixoDoTemplate("compra-venda"), "vendedor");
  assert.equal(prefixoDoTemplate("venda"), "comprador");
  assert.equal(prefixoDoTemplate("consignacao"), "proprietario");
  assert.equal(prefixoDoTemplate("termo-vistoria"), "proprietario");
  assert.equal(prefixoDoTemplate("outro-qualquer"), null);
});

test("compra-venda preenche a ficha do vendedor", () => {
  const campos = camposDoTemplate("compra-venda", CLIENTE_PF);
  assert.equal(campos.vendedor_nome, "Carlos Teste");
  assert.equal(campos.vendedor_cpf, "123.456.789-00");
  assert.equal(campos.vendedor_cnh, "01234567890");
  assert.equal(campos.vendedor_cnh_categoria, "B");
  assert.equal(campos.vendedor_telefone, "(34) 99999-0000");
  assert.equal(campos.vendedor_email, "carlos@exemplo.com");
  assert.equal(
    campos.vendedor_endereco,
    "Rua das Flores, 120, Centro, Uberlândia/MG, CEP 38400-100"
  );
});

test("venda preenche a ficha do comprador", () => {
  const campos = camposDoTemplate("venda", CLIENTE_PF);
  assert.equal(campos.comprador_nome, "Carlos Teste");
  assert.equal(campos.comprador_cpf, "123.456.789-00");
  assert.equal(campos.comprador_telefone, "(34) 99999-0000");
  assert.ok(campos.comprador_endereco.includes("Uberlândia/MG"));
});

test("venda para PJ leva o representante junto", () => {
  const campos = camposDoTemplate("venda", CLIENTE_PJ);
  assert.equal(campos.comprador_nome, "Transportes Teste LTDA");
  assert.equal(campos.comprador_cpf, "12.345.678/0001-90");
  assert.equal(campos.comprador_representante_nome, "Ana Representante");
  assert.equal(campos.comprador_representante_cpf, "987.654.321-00");
});

test("PF não recebe campos de representante", () => {
  const campos = camposDoTemplate("venda", CLIENTE_PF);
  assert.equal("comprador_representante_nome" in campos, false);
});

test("consignacao e termo-vistoria preenchem a ficha do proprietário", () => {
  const consig = camposDoTemplate("consignacao", CLIENTE_PF);
  assert.equal(consig.proprietario_nome, "Carlos Teste");
  assert.equal(consig.proprietario_cpf, "123.456.789-00");
  assert.equal(consig.proprietario_cnh_categoria, "B");

  const vistoria = camposDoTemplate("termo-vistoria", CLIENTE_PF);
  assert.equal(vistoria.proprietario_nome, "Carlos Teste");
  assert.equal(vistoria.proprietario_telefone, "(34) 99999-0000");
});

test("campos vazios do cliente não entram no objeto", () => {
  const campos = camposDoTemplate("compra-venda", { nome: "Só o Nome" });
  assert.equal(campos.vendedor_nome, "Só o Nome");
  assert.equal("vendedor_cnh" in campos, false);
  assert.equal("vendedor_endereco" in campos, false);
});

test("modelo desconhecido e cliente nulo devolvem objeto vazio", () => {
  assert.deepEqual(camposDoTemplate("outro-qualquer", CLIENTE_PF), {});
  assert.deepEqual(camposDoTemplate("venda", null), {});
});

test("destinatarioDoCliente monta o destinatário da NF-e", () => {
  assert.deepEqual(destinatarioDoCliente(CLIENTE_PF), {
    nome: "Carlos Teste",
    doc: "12345678900",
    cep: "38400100",
    logradouro: "Rua das Flores",
    numero: "120",
    bairro: "Centro",
    municipio: "Uberlândia",
    uf: "MG",
  });
});

test("destinatarioDoCliente sem endereço devolve os campos vazios, não undefined", () => {
  const d = destinatarioDoCliente({ nome: "Sem Endereço", doc: "12345678900" });
  assert.equal(d.logradouro, "");
  assert.equal(d.uf, "");
  assert.equal(d.nome, "Sem Endereço");
});

test("destinatarioDoCliente com cliente nulo devolve todos os campos vazios", () => {
  const d = destinatarioDoCliente(null);
  assert.equal(d.nome, "");
  assert.equal(d.doc, "");
});
```

- [ ] **Step 10: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `src/lib/clientes/prefill.js` não existe.

- [ ] **Step 11: Escrever `src/lib/clientes/prefill.js`**

Atenção aos imports: a regra do repositório é que módulo com teste próprio não
usa o alias `@/`, porque ele não resolve em `node --test`. **Import relativo com
extensão `.js` resolve nos dois lados** — bundler e `node --test` — então
`prefill.js` pode importar `doc.js` e `endereco.js`, que são vizinhos e também
puros. Duplicar as funções aqui seria pior.

```js
/**
 * De um cliente cadastrado para os campos de cada modelo de contrato e para o
 * destinatário da NF-e.
 *
 * Testado em `node --test`, onde o alias "@/" não resolve — por isso os imports
 * abaixo são relativos e com extensão. Mesma razão de existir de
 * documentosCliente.js, que decide de qual campo sai o nome do cliente.
 */
import { normalizaDoc, formataDoc } from "./doc.js";
import { enderecoEmUmaLinha } from "./endereco.js";

// Qual ficha do contrato é a do cliente, e o que ele fez com o carro.
const MODELOS = {
  "compra-venda": { prefixo: "vendedor", papel: "vendeu" },
  venda: { prefixo: "comprador", papel: "comprou" },
  consignacao: { prefixo: "proprietario", papel: "consignou" },
  "termo-vistoria": { prefixo: "proprietario", papel: "consignou" },
};

export function papelPorTemplate(templateId) {
  return MODELOS[templateId]?.papel ?? null;
}

/** Prefixo dos campos da ficha do cliente naquele modelo — usado pelo botão
 *  "Salvar como cliente", que faz o caminho inverso do camposDoTemplate. */
export function prefixoDoTemplate(templateId) {
  return MODELOS[templateId]?.prefixo ?? null;
}

function texto(valor) {
  return String(valor ?? "").trim();
}

/** Campos a preencher no formulário do contrato. Campo vazio não entra. */
export function camposDoTemplate(templateId, cliente) {
  const modelo = MODELOS[templateId];
  if (!modelo || !cliente) return {};
  const p = modelo.prefixo;

  const candidatos = {
    [`${p}_nome`]: texto(cliente.nome),
    [`${p}_cpf`]: formataDoc(cliente.doc),
    [`${p}_cnh`]: texto(cliente.cnh),
    [`${p}_cnh_categoria`]: texto(cliente.cnh_categoria),
    [`${p}_endereco`]: enderecoEmUmaLinha(cliente),
    [`${p}_telefone`]: texto(cliente.telefone),
    [`${p}_email`]: texto(cliente.email),
  };

  // Representante só existe em PJ, e só o modelo de venda tem esses campos.
  if (cliente.tipo === "pj" && templateId === "venda") {
    candidatos.comprador_representante_nome = texto(cliente.representante_nome);
    candidatos.comprador_representante_cpf = formataDoc(cliente.representante_cpf);
  }

  const campos = {};
  for (const [chave, valor] of Object.entries(candidatos)) {
    if (valor) campos[chave] = valor;
  }
  return campos;
}

/** Destinatário da NF-e. Sempre com todas as chaves — a validação é na emissão. */
export function destinatarioDoCliente(cliente) {
  const c = cliente || {};
  return {
    nome: texto(c.nome),
    doc: normalizaDoc(c.doc),
    cep: normalizaDoc(c.cep),
    logradouro: texto(c.logradouro),
    numero: texto(c.numero),
    bairro: texto(c.bairro),
    municipio: texto(c.municipio),
    uf: texto(c.uf).toUpperCase(),
  };
}
```

Nota sobre os campos do contrato: os nomes acima vieram de
`src/lib/contractTemplates.js` (`vendedor_*` no modelo `compra-venda`,
`comprador_*` no `venda`, `proprietario_*` em `consignacao` e `termo-vistoria`).
Confira que cada chave existe no `fields` do modelo correspondente antes de dar a
task por pronta — chave que não existe no modelo é preenchimento que some.

- [ ] **Step 12: Rodar e ver passar**

Run: `npm test`
Expected: PASS. Total esperado: 64 + os testes novos.

- [ ] **Step 13: Build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 14: Commit**

```bash
git add src/lib/clientes tests/clientes-*.test.js
git commit -m "feat: módulos puros de cliente (documento, endereço, prefill de contrato e NF-e)"
```

---

### Task 2: Schema e repositório

**Files:**
- Create: `db/clientes-schema.sql`
- Create: `src/lib/clientes/repo.js`
- Modify: `docs/RUNBOOK-BACKUP.md` (uma linha na tabela "O que é copiado" não é necessária — o dump é do banco inteiro; **não altere**)

**Interfaces:**
- Consumes: `normalizaDoc`, `tipoPorDoc`, `docValido` de `@/lib/clientes/doc` (na aplicação, o alias resolve normalmente).
- Produces (de `src/lib/clientes/repo.js`):
  - `listClientes({ busca, incluirInativos }) -> Promise<Array>` (cada linha com `veiculos_count`)
  - `getCliente(id) -> Promise<object|null>` (com `veiculos`, `documentos`, `notas`)
  - `createCliente(data) -> Promise<{cliente}|{error}>`
  - `updateCliente(id, data) -> Promise<{cliente}|{error}>`
  - `setClienteAtivo(id, ativo) -> Promise<void>`
  - `ligarVeiculo({ clienteId, vehicleId, papel, data, origem, documentoId }) -> Promise<{vinculo}|{error}>`
  - `desligarVeiculo(vinculoId) -> Promise<void>`

- [ ] **Step 1: Escrever `db/clientes-schema.sql`**

```sql
-- ============================================================================
-- VAMAQ MOTORS — cadastro de clientes e o vínculo com os veículos.
--
-- Fica no schema `public`, NÃO em `fin`: o schema financeiro roda com role e
-- pool próprios (DATABASE_URL_FIN) e é invisível para o pool do app, então
-- contrato, CRM e fiscal não conseguiriam ler fin.contacts. A listagem de
-- Contatos do financeiro segue existindo e não é tocada por este arquivo.
--
-- Aplicar:  psql "$DATABASE_URL" -f db/clientes-schema.sql   (re-aplicável)
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists clientes (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,
  tipo                text not null default 'pf',
  doc                 text,              -- SÓ DÍGITOS: CPF (11) ou CNPJ (14)
  rg                  text,
  cnh                 text,
  cnh_categoria       text,
  email               text,
  telefone            text,
  cep                 text,
  logradouro          text,
  numero              text,
  complemento         text,
  bairro              text,
  municipio           text,
  uf                  text,
  representante_nome  text,              -- só faz sentido em PJ
  representante_cpf   text,
  obs                 text,
  ativo               boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint cliente_tipo_check check (tipo in ('pf','pj'))
);

-- Dois clientes não podem ter o mesmo documento, mas cliente SEM documento é
-- permitido (é comum cadastrar pelo nome antes de ter o RG na mão) — daí o
-- índice único ser parcial.
create unique index if not exists clientes_doc_key
  on clientes(doc) where doc is not null and doc <> '';

create index if not exists clientes_nome_idx on clientes(lower(nome));

create table if not exists cliente_veiculos (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references clientes(id) on delete cascade,
  vehicle_id    uuid not null references vehicles(id) on delete cascade,
  papel         text not null,
  data          date,
  origem        text not null default 'manual',
  -- de qual contrato o vínculo nasceu; `set null` porque apagar o documento
  -- não pode apagar o fato de que a pessoa comprou o carro.
  documento_id  uuid references documentos_gerados(id) on delete set null,
  obs           text,
  created_at    timestamptz not null default now(),

  constraint cliente_veiculo_papel_check check (papel in ('comprou','vendeu','consignou')),
  constraint cliente_veiculo_origem_check check (origem in ('manual','contrato','nota'))
);

-- Gerar o mesmo contrato duas vezes não pode criar dois vínculos iguais.
create unique index if not exists cliente_veiculos_unico
  on cliente_veiculos(cliente_id, vehicle_id, papel);

create index if not exists cliente_veiculos_vehicle_idx on cliente_veiculos(vehicle_id);

-- Ligação dos registros que já existiam. `set null` nos dois: apagar o cadastro
-- do cliente não pode apagar o contrato nem a nota, que são prova.
alter table documentos_gerados add column if not exists cliente_id uuid;
alter table notas_fiscais      add column if not exists cliente_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'documentos_gerados_cliente_fk') then
    alter table documentos_gerados
      add constraint documentos_gerados_cliente_fk
      foreign key (cliente_id) references clientes(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notas_fiscais_cliente_fk') then
    alter table notas_fiscais
      add constraint notas_fiscais_cliente_fk
      foreign key (cliente_id) references clientes(id) on delete set null;
  end if;
end $$;

create index if not exists documentos_gerados_cliente_idx on documentos_gerados(cliente_id);
create index if not exists notas_fiscais_cliente_idx on notas_fiscais(cliente_id);
```

- [ ] **Step 2: Aplicar no banco local e conferir**

```bash
psql "$DATABASE_URL" -f db/clientes-schema.sql
psql "$DATABASE_URL" -f db/clientes-schema.sql   # segunda vez: tem que passar igual
psql "$DATABASE_URL" -c "\d clientes" -c "\d cliente_veiculos"
psql "$DATABASE_URL" -c "select column_name from information_schema.columns where table_name in ('documentos_gerados','notas_fiscais') and column_name='cliente_id';"
```

Expected: as duas execuções sem erro (é o teste de idempotência), as duas tabelas
descritas, e `cliente_id` aparecendo duas vezes na última consulta.

- [ ] **Step 3: Escrever `src/lib/clientes/repo.js`**

Server-only, no padrão de `src/lib/rh/funcionarios.js` (que é o exemplo mais
próximo: valida, normaliza e devolve `{error}` em vez de lançar quando o erro é
do operador).

Pontos obrigatórios:

- `CAMPOS` = lista das colunas editáveis: `nome, tipo, doc, rg, cnh, cnh_categoria, email, telefone, cep, logradouro, numero, complemento, bairro, municipio, uf, representante_nome, representante_cpf, obs`.
- `prepararCliente(data, { ignorarId })`:
  - `nome` obrigatório → `{ error: "Nome é obrigatório." }`
  - `doc` passa por `normalizaDoc`; se não vazio e `!docValido(doc)` → `{ error: "CPF/CNPJ deve ter 11 ou 14 dígitos." }`
  - `tipo`: se o documento tem tamanho conhecido, use `tipoPorDoc`; senão o que veio, com fallback `'pf'`; qualquer coisa fora de `pf|pj` vira `'pf'`
  - `cep` e `representante_cpf` também normalizados para dígitos
  - `uf` em maiúsculas, cortada em 2 caracteres
  - se `doc` não vazio, checar duplicado: `select id from clientes where doc = $1 and ($2::uuid is null or id <> $2)` → `{ error: "Já existe um cliente com esse CPF/CNPJ." }` (a checagem antecipada dá mensagem boa; o índice único é a garantia real)
  - campos vazios viram `null`, não `""` — assim o índice único parcial funciona
- `listClientes({ busca, incluirInativos })`:
  - sem `busca`: todos, `order by nome`
  - com `busca`: casa por nome (`like` case-insensitive) **ou** por documento **ou** por telefone, comparando os dois lados só por dígitos quando o termo tiver dígitos. Use `regexp_replace(coalesce(doc,''), '\D', '', 'g') like $2` e o mesmo para `telefone`. Escape os curingas `%`, `_` e `\` do termo — copie `escapeCuringasLike` de `src/lib/documentos.js:45`.
  - `incluirInativos` falso (padrão) filtra `where ativo`
  - cada linha traz `veiculos_count` via subselect em `cliente_veiculos`
- `getCliente(id)`: a linha, mais
  - `veiculos`: join com `vehicles` trazendo `cv.id as vinculo_id, cv.papel, cv.data, cv.origem, v.id as vehicle_id, v.brand, v.model, v.year, v.placa, v.status`, `order by cv.data desc nulls last, cv.created_at desc`
  - `documentos`: `select id, tipo, titulo, created_at from documentos_gerados where cliente_id = $1 order by created_at desc`
  - `notas`: `select ref, status, valor, created_at from notas_fiscais where cliente_id = $1 order by created_at desc`
  - devolve `null` se o cliente não existe
- `ligarVeiculo(...)`: `insert ... on conflict (cliente_id, vehicle_id, papel) do nothing returning *`; se `rows` vier vazio, buscar o vínculo existente e devolvê-lo (o chamador não precisa saber a diferença). `papel` fora do check → `{ error: "Papel inválido." }` antes de tocar no banco.
- `desligarVeiculo(vinculoId)`: `delete from cliente_veiculos where id = $1`.
- `updateCliente` seta `updated_at = now()`.

- [ ] **Step 4: Provar o repositório contra o banco local**

O repositório usa o alias `@/`, que não resolve fora do Next — então ele não tem
teste automatizado, e o repo não tem infra de teste com banco. O que se prova
aqui são as **garantias do schema**, direto no `psql`, e elas são o que importa:

```bash
psql "$DATABASE_URL" <<'SQL'
insert into clientes (nome, doc) values ('Teste Um', '12345678900');
insert into clientes (nome, doc) values ('Teste Dois', null);
insert into clientes (nome, doc) values ('Teste Três', null);
SQL
```
Expected: as três passam — dois clientes sem documento são permitidos.

```bash
psql "$DATABASE_URL" -c "insert into clientes (nome, doc) values ('Duplicado','12345678900');"
```
Expected: `ERROR: duplicate key value violates unique constraint "clientes_doc_key"`.

```bash
psql "$DATABASE_URL" <<'SQL'
insert into cliente_veiculos (cliente_id, vehicle_id, papel)
select c.id, v.id, 'comprou' from clientes c, vehicles v
 where c.nome = 'Teste Um' limit 1;
insert into cliente_veiculos (cliente_id, vehicle_id, papel)
select c.id, v.id, 'comprou' from clientes c, vehicles v
 where c.nome = 'Teste Um' limit 1;
SQL
```
Expected: a segunda falha com violação de `cliente_veiculos_unico` — é a garantia
de que gerar o mesmo contrato duas vezes não duplica o vínculo.

```bash
psql "$DATABASE_URL" -c "delete from clientes where nome like 'Teste %';"
psql "$DATABASE_URL" -c "select count(*) from cliente_veiculos;"
```
Expected: o delete leva o vínculo junto (cascade) — a contagem volta ao que era.

- [ ] **Step 5: Build e suíte**

Run: `npm test && npm run build`
Expected: PASS e build limpo (o repositório ainda não é importado por ninguém, mas
não pode quebrar o build).

- [ ] **Step 6: Commit**

```bash
git add db/clientes-schema.sql src/lib/clientes/repo.js
git commit -m "feat: schema de clientes e vínculo cliente-veículo"
```

---

### Task 3: API de clientes

**Files:**
- Create: `src/app/api/admin/clientes/route.js`
- Create: `src/app/api/admin/clientes/[id]/route.js`
- Create: `src/app/api/admin/clientes/[id]/veiculos/route.js`

**Interfaces:**
- Consumes: tudo de `@/lib/clientes/repo` (Task 2) e `requireApiRole` de `@/lib/auth/api`.
- Produces: os endpoints abaixo, consumidos pelas Tasks 4-7.

Modelo a seguir, incluindo o tratamento de erro: `src/app/api/admin/documentos-gerados/route.js`.

- [ ] **Step 1: `src/app/api/admin/clientes/route.js`**

- `export const dynamic = "force-dynamic";`
- `GET`: guarda `["secretaria","financeiro","vendedor"]`. Lê `busca` e `incluirInativos` da query string. Devolve `{ clientes }`. `try/catch` com `console.error` e `{ error: "Falha ao listar os clientes" }` em 500.
- `POST`: guarda `["secretaria","financeiro"]`. Corpo JSON. Chama `createCliente`. `{error}` → 400 com a mensagem. Sucesso → `{ cliente }`.

- [ ] **Step 2: `src/app/api/admin/clientes/[id]/route.js`**

Lembre: **`params` é assíncrono** — `export async function GET(request, { params }) { const { id } = await params; ... }`.

- `GET`: guarda `["secretaria","financeiro","vendedor"]`. `getCliente(id)`; null → 404 `{ error: "Cliente não encontrado" }`.
- `PUT`: guarda `["secretaria","financeiro"]`. `updateCliente(id, body)`.
- `DELETE`: guarda `["secretaria","financeiro"]`. **Não apaga**: chama `setClienteAtivo(id, false)` e devolve `{ ok: true }`. Cliente com contrato ou nota é histórico; apagar de verdade derrubaria o vínculo com o veículo por cascade. Deixe isso escrito num comentário no arquivo.

- [ ] **Step 3: `src/app/api/admin/clientes/[id]/veiculos/route.js`**

- `POST`: guarda `["secretaria","financeiro"]`. Corpo `{ vehicleId, papel, data, obs }`, `origem` fixa em `"manual"` — **a tela nunca escolhe a origem**, senão um vínculo manual se disfarça de vínculo de contrato. Devolve `{ vinculo }`.
- `DELETE`: guarda `["secretaria","financeiro"]`. Lê `vinculoId` da query string. Confira que o vínculo pertence ao cliente da rota antes de apagar — sem isso, qualquer id de vínculo é apagável por qualquer rota de cliente. Devolve `{ ok: true }`.

- [ ] **Step 4: Provar as rotas com o servidor rodando**

Com `npm run dev` e uma sessão válida no navegador não dá para usar `curl` sem
cookie. Prove pelo navegador (console da própria página do admin, que já tem o
cookie):

```js
await fetch("/api/admin/clientes", { method: "POST", headers: {"Content-Type":"application/json"},
  body: JSON.stringify({ nome: "Cliente de Teste", doc: "111.222.333-44", municipio: "Uberlândia", uf: "mg" }) }).then(r => r.json())
// Expected: { cliente: { ..., doc: "11122233344", tipo: "pf", uf: "MG" } }

await fetch("/api/admin/clientes?busca=111.222").then(r => r.json())
// Expected: encontra o cliente mesmo com a pontuação diferente da gravada

await fetch("/api/admin/clientes", { method: "POST", headers: {"Content-Type":"application/json"},
  body: JSON.stringify({ nome: "Outro", doc: "11122233344" }) }).then(r => [r.status, r.json()])
// Expected: 400 com "Já existe um cliente com esse CPF/CNPJ."

await fetch("/api/admin/clientes", { method: "POST", headers: {"Content-Type":"application/json"},
  body: JSON.stringify({ doc: "11122233355" }) }).then(r => [r.status])
// Expected: 400 — nome é obrigatório
```

- [ ] **Step 5: Build e suíte**

Run: `npm test && npm run build`

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/clientes
git commit -m "feat: API de clientes e vínculo com veículos"
```

---

### Task 4: Menu, permissões e tela de lista

**Files:**
- Modify: `src/lib/auth/permissions.js:22-34` (novo item em `SECTIONS`) e `:50` (ordem do menu)
- Create: `src/app/admin/clientes/page.js`
- Create: `src/app/admin/clientes/ClientesClient.js`

**Interfaces:**
- Consumes: `GET/POST /api/admin/clientes` (Task 3), `formataDoc` de `@/lib/clientes/doc`.
- Produces: a rota `/admin/clientes`, e o item de menu que a Task 5 usa como volta.

- [ ] **Step 1: Registrar a seção**

Em `src/lib/auth/permissions.js`, dentro de `SECTIONS`, logo **antes** da linha de `financeiro`:

```js
  { key: "clientes", prefix: "/admin/clientes", label: "Clientes", icon: "🧑", roles: ["secretaria", "financeiro"] },
```

E na ordem do menu (`navFor`), entre `crm` e `financeiro`:

```js
  const order = ["dashboard", "estoque", "crm", "clientes", "financeiro", "fiscal", "documentos", "criativos", "fipe", "tutoriais", "funcionarios", "usuarios"];
```

Cuidado com a ordem dentro de `SECTIONS`: `sectionForPath` casa por prefixo na
ordem do array, e `/admin` (dashboard) tem que continuar por último.

- [ ] **Step 2: Conferir que o papel certo vê o menu**

Run: `npm run build` e depois, no navegador, entrar como `secretaria` e como
`vendedor`.
Expected: secretaria vê "Clientes" no menu; vendedor **não** vê; vendedor abrindo
`/admin/clientes` na barra de endereço é redirecionado (o layout do `/admin` já
faz isso via `canAccessPath`).

- [ ] **Step 3: A tela de lista**

`src/app/admin/clientes/page.js` é o Server Component com a guarda de papel — siga
o padrão de `src/app/admin/funcionarios/page.js` (leia esse arquivo antes) — e
renderiza `<ClientesClient />`.

`ClientesClient.js` (`"use client"`):

- Cabeçalho no padrão do painel: `pageHeader`, `pageTitle` "Clientes",
  `pageSubtitle` "Busque um cliente pelo nome, CPF/CNPJ ou telefone e veja os
  carros dele".
- Cartão "Novo cliente" com `formGrid`: nome*, tipo (select PF/PJ), CPF/CNPJ, RG,
  CNH, categoria, telefone, e-mail, CEP, logradouro, número, complemento, bairro,
  município, UF, representante (só quando tipo = PJ), observações (`textarea`, com
  `` className={`${styles.formGroup} ${styles.formGroupFull}`} ``). Botão "Criar
  cliente" em `formActions`.
- Busca: um `formInput` que filtra chamando `GET /api/admin/clientes?busca=`, com
  debounce simples (`setTimeout` de 300ms limpo no `useEffect`). Uma caixinha
  "incluir inativos".
- Lista em `tableWrap` + `table`: **Cliente** (nome em `<strong>` e e-mail embaixo
  em `fontSize: "0.82rem", color: "#666"` — mesmo tratamento da tela de Usuários),
  **CPF/CNPJ** (via `formataDoc`), **Telefone**, **Carros** (`veiculos_count`),
  **Ações** (link "Abrir ficha" para `/admin/clientes/<id>`).
- Vazio: se não há nenhum cliente, "Nenhum cliente cadastrado ainda."; se a busca
  não achou, "Nenhum cliente encontrado para essa busca." — **mensagens
  diferentes**, como a tela de Documentos gerados já faz.
- Erro da API mostrado no lugar do genérico: use o `{error}` que a rota devolve.

- [ ] **Step 4: Verificar no navegador**

Criar dois clientes (um PF, um PJ), buscar por nome, por CPF com pontuação
diferente da digitada no cadastro, e por telefone. Conferir que a tabela cabe na
tela em 1512px de largura (`document.body.scrollWidth` igual a `innerWidth`).

- [ ] **Step 5: Build, suíte e commit**

```bash
npm test && npm run build
git add src/lib/auth/permissions.js src/app/admin/clientes
git commit -m "feat: tela de clientes com busca por nome, documento e telefone"
```

---

### Task 5: Ficha do cliente

**Files:**
- Create: `src/app/admin/clientes/[id]/page.js`
- Create: `src/app/admin/clientes/[id]/FichaClient.js`

**Interfaces:**
- Consumes: `GET/PUT /api/admin/clientes/[id]`, `POST/DELETE /api/admin/clientes/[id]/veiculos` (Task 3), `GET /api/admin/vehicles` (já existe), `formataDoc`.
- Produces: nada para tasks seguintes.

Leia `src/app/admin/funcionarios/[id]/page.js` e `FichaClient.js` antes de
escrever — é a mesma forma de ficha (dados + histórico), e a consistência importa
mais que a invenção.

- [ ] **Step 1: A página**

`page.js`: Server Component, guarda de papel igual à Task 4, `const { id } = await params`
(**`params` é assíncrono**), carrega com `getCliente(id)` e devolve `notFound()` se
não achar. Passa o objeto para `FichaClient`.

- [ ] **Step 2: Bloco "Dados"**

Formulário com os mesmos campos da criação, preenchidos, e um botão "Salvar
alterações" que chama `PUT`. Um botão secundário "Desativar cliente" (ou
"Reativar") que chama `DELETE`. Depois de salvar, mostrar confirmação curta — não
usar `alert()` para sucesso; siga o que a ficha de funcionário já faz.

- [ ] **Step 3: Bloco "Carros"**

Tabela: veículo (marca, modelo, ano), placa, papel (`comprou` → "Comprou",
`vendeu` → "Vendeu", `consignou` → "Consignou"), data, origem ("do contrato", "da
nota", "manual"), e ações: link para `/admin/estoque/<vehicle_id>` (confira a rota
real da tela do veículo antes) e um botão "Desfazer vínculo".

Abaixo, "Ligar outro carro": um `formSelect` com os veículos do estoque, um select
de papel, um campo de data, e o botão "Ligar". Chama `POST .../veiculos`.

Vazio: "Nenhum carro ligado a este cliente ainda. Os vínculos aparecem sozinhos
quando você gera um contrato com ele selecionado."

- [ ] **Step 4: Bloco "Documentos e notas"**

Duas listas simples: contratos gerados (tipo, título, data, link "Abrir" para
`/api/admin/documentos-gerados/<id>/arquivo` — **confira o caminho real em
`src/app/api/admin/documentos-gerados/`**) e notas emitidas (ref, status, valor,
data). Vazio com frase própria em cada uma.

- [ ] **Step 5: Verificar no navegador**

Abrir a ficha de um cliente, ligar um carro à mão, conferir que ele aparece na
lista com origem "manual" e que o contador de carros da tela de lista subiu.
Ligar o mesmo carro com o mesmo papel de novo e conferir que **não** duplica.
Desfazer o vínculo e conferir que sai.

- [ ] **Step 6: Build, suíte e commit**

```bash
npm test && npm run build
git add src/app/admin/clientes
git commit -m "feat: ficha do cliente com os carros, contratos e notas dele"
```

---

### Task 6: Integração com o gerador de contratos

**Files:**
- Modify: `src/app/admin/documentos/page.js`
- Modify: `src/app/api/admin/documentos-gerados/route.js` (POST aceita `clienteId`)
- Modify: `src/lib/documentos.js` (`salvarDocumento` grava `cliente_id` e cria o vínculo)

**Interfaces:**
- Consumes: `camposDoTemplate`, `papelPorTemplate` de `@/lib/clientes/prefill`; `GET/POST /api/admin/clientes`; `ligarVeiculo` de `@/lib/clientes/repo`.
- Produces: nada para tasks seguintes.

- [ ] **Step 1: `salvarDocumento` passa a aceitar `clienteId`**

Em `src/lib/documentos.js`, a assinatura vira
`salvarDocumento({ tipo, titulo, cliente, clienteId, vehicleId, criadoPor, buffer })`.
O `insert` ganha a coluna `cliente_id`. **Nada mais muda** — em especial, o
`unlink` do arquivo órfão no `catch` continua exatamente como está.

Depois do insert bem-sucedido, se houver `clienteId` **e** `vehicleId`, criar o
vínculo:

```js
const papel = papelPorTemplate(tipo);
if (clienteId && vehicleId && papel) {
  // O vínculo é um efeito colateral desejável, não a razão de existir do
  // contrato: falhar aqui não pode desfazer um documento já gravado.
  try {
    await ligarVeiculo({
      clienteId, vehicleId, papel, origem: "contrato", documentoId: rows[0].id,
    });
  } catch (err) {
    console.error("Contrato gravado, mas o vínculo cliente-veículo falhou:", err);
  }
}
```

- [ ] **Step 2: A rota repassa `clienteId`**

Em `src/app/api/admin/documentos-gerados/route.js`, no `POST`, ler
`clienteId: String(formData.get("clienteId") || "").slice(0, 200) || null` e passar
adiante. Nada mais muda.

- [ ] **Step 3: O seletor de cliente na tela**

Em `src/app/admin/documentos/page.js`:

- Estado novo: `const [clientes, setClientes] = useState([])` e
  `const [clienteIdSel, setClienteIdSel] = useState("")`.
- Carregar a lista no `useEffect` que já busca veículos e prefills:
  `fetch("/api/admin/clientes").then(r => r.json()).then(d => setClientes(d.clientes || [])).catch(() => {})`.
- **Zerar `clienteIdSel` em `selectTemplate` e em `openPrefill`**, junto do
  `setVehicleIdSel("")` que já está lá. Isto não é detalhe: exatamente esse
  esquecimento, com `vehicleIdSel`, fez um contrato ser arquivado no dossiê do
  carro anterior, com os dados de outra pessoa.
- Um cartão novo **acima** do cartão "Preencher dados do veículo automaticamente",
  com `<h3>` "Preencher dados do cliente automaticamente" e um `formSelect`:

```jsx
<select
  className={styles.formSelect}
  value={clienteIdSel}
  onChange={(e) => fillFromCliente(e.target.value)}
>
  <option value="">Selecione um cliente cadastrado...</option>
  {clientes.map((c) => (
    <option key={c.id} value={c.id}>
      {c.nome}{c.doc ? ` — ${formataDoc(c.doc)}` : ""}
    </option>
  ))}
</select>
```

- `fillFromCliente(id)`: guarda o id no estado e, achando o cliente na lista,
  aplica `setValues((prev) => ({ ...prev, ...camposDoTemplate(selectedTemplate.id, cliente) }))`.
  Espalhar por cima de `prev` é o que garante a promessa da spec: escolher um
  cliente **não apaga** o que já foi digitado em campos que o cadastro não
  preenche.
- Se `clientes.length === 0`, no lugar do select: "Nenhum cliente cadastrado
  ainda." (sem link para a tela, que o vendedor não acessa).

- [ ] **Step 4: Enviar o `clienteId` ao guardar a cópia**

Em `handleDownloadPdf`, junto de `fd.set("vehicleId", ...)`:

```js
if (clienteIdSel) fd.set("clienteId", clienteIdSel);
```

- [ ] **Step 5: Botão "Salvar como cliente"**

Ao lado do select, um `btnSecondary` "Salvar como cliente" que monta um cadastro a
partir dos valores já digitados e chama `POST /api/admin/clientes`:

```js
const p = prefixoDoTemplate(selectedTemplate.id);
const novo = {
  nome: values[`${p}_nome`],
  doc: values[`${p}_cpf`],
  cnh: values[`${p}_cnh`],
  cnh_categoria: values[`${p}_cnh_categoria`],
  telefone: values[`${p}_telefone`],
  email: values[`${p}_email`],
};
```

O endereço **não** entra: no contrato ele é uma linha só, e o cadastro guarda em
partes; adivinhar a separação criaria endereço errado na NF-e, que é justamente o
que este trabalho veio consertar. Quem cadastrou assim completa o endereço depois
na ficha.

O botão aparece para todo mundo, e o resultado é tratado pelo status: `403` mostra
"Você não tem permissão para cadastrar clientes — peça à secretaria."; `400`
mostra a mensagem que a API devolveu (nome vazio, documento duplicado); sucesso
mostra "Cliente cadastrado." e já seleciona o cliente novo no select. Não use
`alert()`.

`DocumentosPage` é uma página client inteira (`"use client"` na primeira linha) —
não há Server Component em volta para passar o papel como prop, e **reestruturar a
página não faz parte desta task**. Tratar pelo status é a solução, não um
contorno: a autorização de verdade está na API, e é lá que ela tem que estar.

- [ ] **Step 6: O cenário que já mordeu uma vez**

No navegador, com banco local:

1. Escolher "Contrato de venda", escolher um cliente, escolher um carro, gerar,
   baixar o PDF.
2. Conferir em `/admin/clientes/<id>` que o carro apareceu com papel "Comprou" e
   origem "do contrato".
3. Clicar em "Novo Documento", escolher "Termo de vistoria", **sem** escolher
   cliente nem carro, gerar e baixar.
4. Conferir que o segundo documento **não** foi ligado ao cliente nem ao carro do
   primeiro.

- [ ] **Step 7: Build, suíte e commit**

```bash
npm test && npm run build
git add src/app/admin/documentos/page.js src/app/api/admin/documentos-gerados/route.js src/lib/documentos.js
git commit -m "feat: contrato puxa os dados do cliente cadastrado e registra o carro dele"
```

---

### Task 7: Integração com a emissão de NF-e

**Files:**
- Modify: `src/app/admin/fiscal/emitir/[vehicleId]/EmitirClient.js`
- Modify: `src/app/admin/fiscal/emitir/[vehicleId]/page.js` (passar a lista de clientes)
- Modify: `src/app/admin/fiscal/actions.js` (`emitirNotaAction` aceita `clienteId`)
- Modify: `src/lib/fiscal/notas.js` (`emitirNotaVeiculo` grava `cliente_id` e cria o vínculo)

**Interfaces:**
- Consumes: `destinatarioDoCliente` de `@/lib/clientes/prefill`; `listClientes` e `ligarVeiculo` de `@/lib/clientes/repo`.
- Produces: nada.

- [ ] **Step 1: `emitirNotaVeiculo` aceita e grava o cliente**

Em `src/lib/fiscal/notas.js`, a assinatura vira
`emitirNotaVeiculo(vehicleId, { destinatario, valorVenda, custoAquisicao, clienteId })`.

O `insert into notas_fiscais` ganha `cliente_id` (a coluna já existe desde a
Task 2). **Toda a validação existente fica intacta**: emissor configurado, veículo
vendido, nota duplicada, custo de aquisição autoritativo do financeiro. O cliente
selecionado **não** substitui a validação do destinatário em
`montarPayloadNfe` — o que vai para a SEFAZ continua sendo o que está no
formulário.

Depois de `salvarRetorno`, se houver `clienteId`, criar o vínculo `comprou` com
origem `"nota"`, dentro de `try/catch` que só loga — uma nota autorizada não pode
virar erro porque o vínculo falhou.

- [ ] **Step 2: A action repassa**

Em `src/app/admin/fiscal/actions.js`, `emitirNotaAction(vehicleId, { destinatario, valorVenda, custoAquisicao, clienteId })`
repassa `clienteId`. A guarda `requireRole(["admin", "financeiro"])` não muda.

- [ ] **Step 3: A lista de clientes chega à tela**

Em `src/app/admin/fiscal/emitir/[vehicleId]/page.js` (Server Component), carregar
`listClientes({})` e passar como prop `clientes` para `EmitirClient`.

- [ ] **Step 4: O seletor e os campos controlados**

Hoje os inputs do destinatário são **não controlados** (`<input name="nome" required />`)
e o valor sai do `FormData`. Para o seletor conseguir preenchê-los, passe os oito
campos a controlados:

```js
const [dest, setDest] = useState({
  nome: "", doc: "", cep: "", logradouro: "", numero: "", bairro: "", municipio: "", uf: "",
});
function setCampo(k, v) { setDest((p) => ({ ...p, [k]: v })); }
```

Cada input vira `value={dest.nome} onChange={(e) => setCampo("nome", e.target.value)}`,
mantendo `name`, `required` e o `maxLength={2}` da UF. **Confira como o
`onSubmit`/`action` monta o objeto hoje** e ajuste para ler de `dest` em vez do
`FormData`, sem mudar mais nada do fluxo.

Acima do cartão "Destinatário", um cartão com o `formSelect` de clientes; ao
escolher, `setDest(destinatarioDoCliente(cliente))` e guardar `clienteIdSel`.
Frase curta abaixo: "Confira os dados antes de emitir — a nota vai para a SEFAZ
com o que estiver aqui."

- [ ] **Step 5: Verificar no navegador**

**Sem emitir nada em produção.** Com banco local e o emissor desativado
(`focusEnabled()` falso), a tela mostra o aviso de emissor não ativado e não dá
para testar o fluxo inteiro — nesse caso, prove só o preenchimento: escolher o
cliente e conferir que os oito campos foram preenchidos e continuam editáveis.
Se houver token de homologação configurado, siga até a emissão e confira o
vínculo `comprou` com origem "da nota" na ficha do cliente.

- [ ] **Step 6: Build, suíte e commit**

```bash
npm test && npm run build
git add src/app/admin/fiscal src/lib/fiscal/notas.js
git commit -m "feat: emissão de NF-e puxa o destinatário do cliente cadastrado"
```

---

## Fora do escopo, de propósito

- Ligar o card do CRM a um cliente cadastrado — o CRM vai ser redesenhado em
  seguida.
- Migrar ou espelhar `fin.contacts`. A listagem de Contatos do financeiro
  continua exatamente como está.
- Validação de dígito verificador de CPF/CNPJ.
- Busca de endereço por CEP.
- Tutoriais das telas novas — é item próprio da fila.

## Depois das tasks (com o controlador, não com subagente)

1. Revisão final da branch inteira, no modelo mais capaz.
2. Roteiro no navegador contra banco local descartável, incluindo o cenário do
   Step 6 da Task 6.
3. Deploy: **aplicar `db/clientes-schema.sql` na VPS antes do `npm run build`**,
   como todo schema deste projeto.
4. Conferir em produção que o menu Clientes aparece para secretaria e admin, e
   não aparece para vendedor.
