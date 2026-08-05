# Vincular login existente pela ficha — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na ficha do funcionário, permitir ligar um login que já existe — o caso de todo mundo que já trabalhava na loja quando a feature subiu.

**Architecture:** Nada novo no banco. A página da ficha passa a carregar os logins sem ficha, uma Server Action nova chama o `setUserFuncionario` que já existe, e o bloco "Acesso ao sistema" ganha um seletor ao lado do formulário de criar.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Postgres via `pg`, CSS Modules.

**Spec:** `docs/superpowers/specs/2026-08-05-vincular-usuario-existente-design.md`

## Global Constraints

- **Leia o guia do Next antes de escrever código**: este Next tem mudanças de API em relação ao seu treino — consulte `node_modules/next/dist/docs/` (regra do `AGENTS.md`).
- JavaScript puro (sem TypeScript), CSS Modules já existentes — sem CSS novo, sem dependência nova.
- Código, textos de tela e comentários em português, linguagem direta (a usuária é dona de loja de carros, não técnica).
- **Toda Server Action começa com `await requireRole("admin")`** — a seção Funcionários é só admin.
- **Nada de banco novo:** `setUserFuncionario(userId, funcionarioId)` e o índice único `users_funcionario_idx` já existem e já estão em produção.
- `styles.formGroupFull` sozinho não empilha rótulo e campo — campo de linha inteira usa `${styles.formGroup} ${styles.formGroupFull}`.
- Um commit, mensagem em português no padrão `feat:`.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/app/admin/funcionarios/[id]/page.js` (modificar) | Carregar também os logins sem ficha. |
| `src/app/admin/funcionarios/actions.js` (modificar) | `vincularUsuarioAction`, com o tratamento da constraint. |
| `src/app/admin/funcionarios/[id]/FichaClient.js` (modificar) | Seletor + botão Vincular no bloco que já existe. |

---

### Task 1: Vincular login existente pela ficha

**Files:**
- Modify: `src/app/admin/funcionarios/[id]/page.js`
- Modify: `src/app/admin/funcionarios/actions.js`
- Modify: `src/app/admin/funcionarios/[id]/FichaClient.js`

**Interfaces:**
- Consumes: `setUserFuncionario(userId, funcionarioId)` de `@/lib/auth/users` (devolve `{ id, funcionario_id }` ou `null`); `listUsers()` de `@/lib/auth/users` (devolve `id, name, email, role, active, must_change_password, approval_limit, created_at, funcionario_id`); `requireRole` de `@/lib/auth/dal`.
- Produces: Server Action `vincularUsuarioAction(funcionarioId, userId)` → `{ ok: true }` ou `{ error }`; prop `usuariosLivres` no `FichaClient`.

- [ ] **Step 1: Carregar os logins sem ficha na página**

Em `src/app/admin/funcionarios/[id]/page.js`, acrescentar o import e a carga, e passar a prop nova:

```js
import { listUsers } from "@/lib/auth/users";
```

```js
export default async function FichaPage({ params }) {
  await requireRole("admin");
  const { id } = await params;
  const funcionario = await getFuncionario(id);
  if (!funcionario) notFound();
  // Logins que ainda não pertencem a nenhuma ficha — são os candidatos a vínculo.
  const usuariosLivres = (await listUsers()).filter((u) => !u.funcionario_id);
  return <FichaClient funcionario={funcionario} roles={ROLES} usuariosLivres={usuariosLivres} />;
}
```

- [ ] **Step 2: Criar a Server Action**

Em `src/app/admin/funcionarios/actions.js`, acrescentar `setUserFuncionario` ao import existente de `@/lib/auth/users` (que hoje traz só `createUser`) e a action ao final do arquivo:

```js
/**
 * Liga um login que já existe a esta ficha. O caso real: quem já trabalhava na
 * loja teve o acesso criado antes de existir cadastro de funcionário.
 * Desvincular continua em /admin/usuarios.
 */
export async function vincularUsuarioAction(funcionarioId, userId) {
  await requireRole("admin");
  if (!userId) return { error: "Escolha um acesso para vincular." };
  try {
    await setUserFuncionario(userId, funcionarioId);
  } catch (err) {
    if (err?.constraint === "users_funcionario_idx") {
      return { error: "Essa ficha já está ligada a outro login." };
    }
    throw err;
  }
  revalidatePath(`/admin/funcionarios/${funcionarioId}`);
  revalidatePath("/admin/funcionarios");
  revalidatePath("/admin/usuarios");
  return { ok: true };
}
```

- [ ] **Step 3: Seletor e botão na ficha**

Em `src/app/admin/funcionarios/[id]/FichaClient.js`:

1. Acrescentar `vincularUsuarioAction` ao import de `../actions`.
2. Mudar a assinatura para `export default function FichaClient({ funcionario: f, roles, usuariosLivres })`.
3. Acrescentar o estado da seleção, junto dos outros `useState`:

```js
  const [usuarioSel, setUsuarioSel] = useState("");
```

4. No bloco "Acesso ao sistema", localize o ramo que hoje renderiza o formulário de criar (começa em `) : !acesso ? (` e contém `onSubmit={criarAcessoSubmit}`). Envolva esse `<form>` — **sem alterar uma linha dele** — num fragmento `<>...</>`, e insira o bloco abaixo **imediatamente antes** dele. O seletor só aparece havendo logins livres:

```jsx
            {usuariosLivres.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: "0.85rem", color: "#666", marginTop: 0 }}>
                  Se esta pessoa já entra no sistema, ligue o acesso que ela usa hoje.
                </p>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Acesso existente</label>
                    <select
                      className={styles.formSelect}
                      value={usuarioSel}
                      onChange={(e) => setUsuarioSel(e.target.value)}
                    >
                      <option value="">— escolha —</option>
                      {usuariosLivres.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.email} — {roles[u.role] || u.role}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formActions}>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      disabled={isPending || !usuarioSel}
                      onClick={() => run(() => vincularUsuarioAction(f.id, usuarioSel))}
                    >
                      Vincular
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: 0 }}>
                  Ou crie um acesso novo:
                </p>
              </div>
            )}
```

O formulário de criar acesso continua logo abaixo, byte a byte como está hoje — a única mudança nele é passar a viver dentro do fragmento. Não toque no ramo que mostra o login já vinculado nem no bloco da senha temporária.

- [ ] **Step 4: Verificar**

Run: `npm test && npm run build`
Expected: 49 testes verdes, build sem erro.

Você **não tem navegador nem sessão logada**: não faça verificação visual e não invente que fez. O controlador vai conferir no navegador — em especial que o seletor some quando todos os logins já têm ficha, e que o botão Vincular aparece desabilitado (a regra `:disabled` está em `admin.module.css`) enquanto nada estiver escolhido.

- [ ] **Step 5: Commitar**

```bash
git add src/app/admin/funcionarios
git commit -m "feat: vincular login existente pela ficha do funcionário"
```

---

## Notas de revisão

- **Cobertura da spec:** carga dos logins livres (Step 1), action com tratamento da constraint (Step 2), seletor + botão + o "ou crie um acesso novo" (Step 3). O ramo com login já vinculado e o de desvincular ficam intocados, como a spec manda.
- **Sem teste novo:** o contrato crítico (um login por ficha) já é provado pelo índice único em `tests/rh-schema.test.mjs`. Não há harness de componente React, e criar um está fora de escopo — a verificação é build mais navegador.
