# Três ajustes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emitir nota tem porta de entrada pela tela de Notas Fiscais; no mobile a foto vem antes do formulário do veículo nos criativos; e digitar a placa acha o carro.

**Architecture:** Três mudanças de tela, independentes entre si. Nenhuma toca modelo de dados. A única lógica com risco silencioso — normalizar o texto da busca — vira função pura com teste.

**Tech Stack:** Next.js 16 (App Router), React 19, CSS Modules, testes com `node:test`.

**Spec:** `docs/superpowers/specs/2026-08-07-tres-ajustes-design.md`

## Global Constraints

- **Leia o guia do Next antes de escrever código**: este Next tem mudanças de API em relação ao seu treino — `node_modules/next/dist/docs/` (regra do `AGENTS.md`).
- JavaScript puro (sem TypeScript). Código, textos de tela e comentários em português, linguagem direta (a usuária é dona de loja de carros).
- **Sem dependência nova.** CSS: só a Task 2 acrescenta regras, e dentro da media query que já existe.
- **Não altere o script `test` do `package.json`** e não introduza loader nem flag experimental. Obstáculo que pareça exigir isso: **pare e reporte BLOCKED**.
- **O alias `@/` não resolve em `node --test`** — módulo com teste unitário importa por caminho relativo e não pode ter imports.
- Suíte atual: **59 testes**. Testes: `npm test` = `node --test --test-concurrency=1 tests/*.test.mjs`.
- Um commit por task, mensagem em português no padrão `feat:`.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/app/admin/fiscal/page.js` (modificar) | Carregar os veículos vendidos. |
| `src/app/admin/fiscal/FiscalClient.js` (modificar) | Botão "Emitir nota" + seletor. |
| `src/app/admin/admin.module.css` (modificar) | Ordem dos cartões em coluna única. |
| `src/app/admin/criativos/page.js` (modificar) | Classes de ordem nos dois cartões. |
| `src/lib/buscaVeiculo.js` (criar) | `normalizaBusca` — puro, testado. |
| `src/app/admin/estoque/page.js` (modificar) | Placa no filtro + aceitar `?busca=`. |
| `src/app/admin/page.js` (modificar) | Atalho "Buscar por placa". |
| `tests/busca-veiculo.test.mjs` (criar) | Normalização da busca. |

---

### Task 1: Emitir nota pela tela de Notas Fiscais

**Files:**
- Modify: `src/app/admin/fiscal/page.js`
- Modify: `src/app/admin/fiscal/FiscalClient.js`

**Interfaces:**
- Consumes: `readVehicles()` de `@/lib/vehicleStore` (devolve todos os veículos, cada um com `id, brand, model, year, placa, status`); `focusEnabled()` de `@/lib/fiscal/notas`.
- Produces: nada para tasks seguintes.

- [ ] **Step 1: Carregar os vendidos na página**

Em `src/app/admin/fiscal/page.js`, acrescentar o import e a carga, passando a prop nova:

```js
import { readVehicles } from "@/lib/vehicleStore";
```

```js
export default async function FiscalPage() {
  await requireRole(["admin", "financeiro"]);
  const notas = await listNotas();
  // A nota nasce da venda: só veículo vendido pode ser emitido.
  const vendidos = (await readVehicles()).filter((v) => v.status === "vendido");
  return <FiscalClient notas={notas} ativo={focusEnabled()} vendidos={vendidos} />;
}
```

- [ ] **Step 2: Botão e seletor no client**

Em `src/app/admin/fiscal/FiscalClient.js`:

1. Mudar a assinatura para `export default function FiscalClient({ notas, ativo, vendidos })`.
2. Acrescentar, junto dos outros `useState`, o estado do seletor:

```js
  const [veiculoSel, setVeiculoSel] = useState("");
```

3. Logo **abaixo** do bloco `<div className={styles.pageHeader}>…</div>` e **antes** do aviso `{!ativo && (…)}`, inserir o bloco de emissão. Ele só existe com a integração ativa:

```jsx
      {ativo && (
        <div className={styles.card} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12 }}>
            Emitir nota
          </h3>
          {vendidos.length === 0 ? (
            <p style={{ fontSize: "0.9rem", color: "#666", margin: 0 }}>
              Nenhum veículo vendido no momento — a nota nasce da venda. Marque o
              carro como vendido no Estoque para poder emitir.
            </p>
          ) : (
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Veículo vendido</label>
                <select
                  className={styles.formSelect}
                  value={veiculoSel}
                  onChange={(e) => setVeiculoSel(e.target.value)}
                >
                  <option value="">— escolha —</option>
                  {vendidos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.brand} {v.model} {v.year}
                      {v.placa ? ` — ${v.placa}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formActions}>
                <Link
                  href={veiculoSel ? `/admin/fiscal/emitir/${veiculoSel}` : "#"}
                  className={styles.btnPrimary}
                  aria-disabled={!veiculoSel}
                  style={!veiculoSel ? { opacity: 0.55, pointerEvents: "none" } : undefined}
                >
                  Emitir nota
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
```

Confira que `Link` já está importado no arquivo; se não estiver, acrescente `import Link from "next/link";`.

- [ ] **Step 3: Verificar**

Run: `npm test && npm run build`
Expected: 59 testes verdes, build sem erro.

Você **não tem navegador nem sessão logada**: não faça verificação visual e não invente que fez.

- [ ] **Step 4: Commitar**

```bash
git add src/app/admin/fiscal
git commit -m "feat: emitir nota direto pela tela de Notas Fiscais"
```

---

### Task 2: Foto principal antes do veículo em coluna única

**Files:**
- Modify: `src/app/admin/admin.module.css`
- Modify: `src/app/admin/criativos/page.js`

**Interfaces:**
- Consumes: `.creativePanel`, que já é `display: flex; flex-direction: column` (`admin.module.css:673`).
- Produces: nada.

- [ ] **Step 1: Marcar os dois cartões**

Em `src/app/admin/criativos/page.js` há dois cartões dentro de `{showVeiculo && (…)}`: o de título **"Veículo"** (por volta da linha 383) e o de título **"Foto principal"** (por volta da linha 451). Ambos usam `className={styles.card}`.

Acrescente a classe de ordem a cada um, **sem** tirar `styles.card`:

- cartão "Veículo" → `className={`${styles.card} ${styles.creativeCardVeiculo}`}`
- cartão "Foto principal" → `className={`${styles.card} ${styles.creativeCardFoto}`}`

Não mexa em mais nada nesses cartões.

- [ ] **Step 2: Ordenar na media query que já existe**

Em `src/app/admin/admin.module.css`, dentro do bloco `@media (max-width: 1020px)` que já existe (o mesmo que faz `.creativePreview { order: -1 }`), acrescente:

```css
  /* Em coluna única a pré-visualização vai para o topo; a foto principal vem
     logo abaixo dela, porque é o campo que mais conversa com o que se vê.
     O formulário do veículo desce. No desktop (2 colunas) nada muda. */
  .creativeCardFoto {
    order: 1;
  }
  .creativeCardVeiculo {
    order: 2;
  }
```

Os demais cartões do painel ficam com `order: 0` (padrão do flex) e portanto **acima** dos dois — o cartão de dicas do template continua no topo, que é onde ele deve ficar.

- [ ] **Step 3: Verificar**

Run: `npm run build`
Expected: compila sem erro.

Confirme por leitura que as duas classes novas existem no CSS e que os dois cartões as usam. **Sem navegador**: a conferência visual em largura de celular fica para o controlador.

- [ ] **Step 4: Commitar**

```bash
git add src/app/admin/criativos src/app/admin/admin.module.css
git commit -m "feat: foto principal antes do veículo em tela estreita"
```

---

### Task 3: Achar o carro pela placa

**Files:**
- Create: `src/lib/buscaVeiculo.js`
- Test: `tests/busca-veiculo.test.mjs`
- Modify: `src/app/admin/estoque/page.js`
- Modify: `src/app/admin/page.js`

**Interfaces:**
- Consumes: nada.
- Produces: `normalizaBusca(texto) -> string` — minúsculas, só letras e números.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/busca-veiculo.test.mjs`:

```js
/**
 * Normalização da busca de veículo. Pura — sem banco, sem rede.
 *
 * A placa é o motivo desta função existir: a pessoa digita ABC-1D23, abc1d23
 * ou ABC 1D23 e tem que achar o mesmo carro.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizaBusca } from "../src/lib/buscaVeiculo.js";

test("ignora maiúsculas", () => {
  assert.equal(normalizaBusca("ABC1D23"), "abc1d23");
});

test("descarta hífen, espaço e ponto", () => {
  assert.equal(normalizaBusca("ABC-1D23"), "abc1d23");
  assert.equal(normalizaBusca("ABC 1D23"), "abc1d23");
  assert.equal(normalizaBusca("A.B.C-1D23"), "abc1d23");
});

test("as três formas de digitar a placa dão no mesmo", () => {
  const formas = ["ABC-1D23", "abc 1d23", "ABC1D23"];
  const [primeira, ...resto] = formas.map(normalizaBusca);
  for (const f of resto) assert.equal(f, primeira);
});

test("preserva letras e números de marca e modelo", () => {
  assert.equal(normalizaBusca("Audi Q5"), "audiq5");
  assert.equal(normalizaBusca("320i"), "320i");
});

test("aguenta vazio, nulo e indefinido", () => {
  assert.equal(normalizaBusca(""), "");
  assert.equal(normalizaBusca(null), "");
  assert.equal(normalizaBusca(undefined), "");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/busca-veiculo.test.mjs`
Expected: FAIL — `Cannot find module .../src/lib/buscaVeiculo.js`

- [ ] **Step 3: Implementar**

Criar `src/lib/buscaVeiculo.js` — **sem nenhum import**, para poder ser testado com `node --test` (o alias `@/` não resolve lá):

```js
/**
 * Normaliza texto de busca de veículo: minúsculas, só letras e números.
 *
 * Existe por causa da placa: ABC-1D23, abc 1d23 e ABC1D23 são a mesma placa, e
 * a pessoa digita do jeito que estiver acostumada. Descartar a pontuação dos
 * DOIS lados da comparação é o que faz o hífen deixar de quebrar a busca.
 *
 * Puro e sem imports de propósito — é o único ponto desta entrega onde um erro
 * passaria despercebido, então tem teste.
 */
export function normalizaBusca(texto) {
  return String(texto ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/busca-veiculo.test.mjs`
Expected: PASS — 5 testes.

- [ ] **Step 5: Usar no estoque, com a placa**

Em `src/app/admin/estoque/page.js` (componente cliente):

1. Importar: `import { normalizaBusca } from "@/lib/buscaVeiculo";`
2. Trocar o filtro, que hoje é:

```js
  const filtered = vehicles.filter((v) =>
    `${v.brand} ${v.model} ${v.color}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );
```

por:

```js
  // A placa entra na busca — é o jeito mais natural de procurar um carro
  // específico, e antes ela não era considerada.
  const alvo = normalizaBusca(search);
  const filtered = alvo
    ? vehicles.filter((v) =>
        normalizaBusca(`${v.brand} ${v.model} ${v.color} ${v.placa || ""}`).includes(alvo)
      )
    : vehicles;
```

- [ ] **Step 6: Aceitar `?busca=` na URL**

Ainda em `src/app/admin/estoque/page.js`, o estado inicial da busca passa a vir da URL, para o atalho do Dashboard funcionar:

```js
import { useSearchParams } from "next/navigation";
```

```js
  const searchParams = useSearchParams();
  // Vem do atalho "Buscar por placa" do Dashboard: /admin/estoque?busca=ABC1D23
  const [search, setSearch] = useState(searchParams.get("busca") || "");
```

**Leia o guia do Next** sobre `useSearchParams` antes de rodar o build: nesta versão ele exige que o componente esteja dentro de um `<Suspense>`, e o build falha com uma mensagem específica quando não está. Se esbarrar nisso, o padrão é extrair o conteúdo atual para um componente interno e deixar o `export default` só envolvendo:

```js
export default function EstoquePage() {
  return (
    <Suspense fallback={<p>Carregando…</p>}>
      <EstoqueConteudo />
    </Suspense>
  );
}
```

Diga no relatório se precisou fazer isso.

- [ ] **Step 7: Atalho no Dashboard**

`src/app/admin/page.js` já é `"use client"`. Em *Ações Rápidas* (por volta da linha 75, no `div` com os `Link`), acrescente um formulário curto de busca por placa, ao lado dos botões:

```jsx
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const placa = e.currentTarget.placa.value.trim();
                  if (placa) router.push(`/admin/estoque?busca=${encodeURIComponent(placa)}`);
                }}
                style={{ display: "flex", gap: 8 }}
              >
                <input
                  name="placa"
                  className={styles.formInput}
                  placeholder="Buscar por placa"
                  style={{ width: 180 }}
                />
                <button type="submit" className={styles.btnSecondary}>
                  Buscar
                </button>
              </form>
```

Acrescente `import { useRouter } from "next/navigation";` e `const router = useRouter();` no componente.

- [ ] **Step 8: Verificar**

Run: `npm test && npm run build`
Expected: **64 testes verdes** (59 + 5) e build sem erro.

Sem navegador: a conferência de tela fica para o controlador.

- [ ] **Step 9: Commitar**

```bash
git add src/lib/buscaVeiculo.js tests/busca-veiculo.test.mjs src/app/admin/estoque/page.js src/app/admin/page.js
git commit -m "feat: busca por placa no estoque e atalho no dashboard"
```

---

## Notas de revisão

- **Cobertura da spec:** porta de entrada da emissão (Task 1), ordem dos cartões em coluna única com o corte em 1020px (Task 2), placa na busca com normalização testada e atalho no Dashboard (Task 3).
- **Teste só onde falha em silêncio:** ordem de bloco e navegação se veem na tela; a normalização da busca não. Por isso ela é a única com teste — e é a que decide se a busca acha ou não o carro.
- **Fora de escopo, por decisão:** página de histórico consolidada do veículo.
