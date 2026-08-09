# Tutoriais das telas novas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quatro tutoriais novos (Clientes, CRM, Notas Fiscais, Funcionários) e dois atualizados (Estoque, Documentos), no formato que já existe.

**Architecture:** Páginas estáticas, Server Components, sem estado e sem chamada de API. Cada tutorial é um arquivo `page.js` sob `src/app/admin/tutoriais/<slug>/`.

**Tech Stack:** Next.js 16 (App Router), CSS Modules (`tutorial.module.css`, já existente).

**Spec:** `docs/superpowers/specs/2026-08-09-tutoriais-design.md` — **ela carrega o conteúdo**, não só o desenho. Leia a seção do seu tutorial antes de escrever.

## Global Constraints

- **Copie a forma de um tutorial existente.** `src/app/admin/tutoriais/fipe/page.js` é o menor e mostra a estrutura inteira; `.../estoque/page.js` mostra um mais longo. Leia pelo menos um antes de escrever.
- **Nenhuma classe nova** em `tutorial.module.css` nem em `admin.module.css`. As que existem: `wrap`, `backLink`, `sectionTitle`, `lead`, `step`, `stepNumber`, `stepBody`, `stepTitle`, `warning`, `danger`, `tip`, `boxLabel`, `checklist`, `checkbox`, `uiField`, `uiButton`, `modelGrid`, `modelCard`, `modelName`, `modelDescription`, `modelWhen`, `whenLabel`, `math`, `mathTotal`.
- **`uiField`** cita um campo ou menu da tela; **`uiButton`** cita um botão. Use para o texto casar com o que a pessoa vê.
- **Todo link interno tem que existir.** Já verificados e liberados: `/admin/clientes`, `/admin/crm`, `/admin/fiscal`, `/admin/funcionarios`, `/admin/documentos/guia`, `/admin/documentos/gerados`, `/admin/estoque/novo`, e os tutoriais `/admin/tutoriais/{estoque,documentos,criativos,fipe,financeiro}`. **Qualquer outro caminho: confira que o arquivo existe antes de linkar.**
- **`export const metadata = { title: "Tutorial: <Nome> — Vamaq Motors" }`** em cada página.
- Português do Brasil, tom direto, segunda pessoa ("você"). Frases curtas.
- **Não invente comportamento.** Se precisar afirmar algo que a spec não diz, **leia o código** da tela em questão e confirme. Preferir omitir a chutar.
- Rode `npm run build` antes de commitar (não há teste novo; a suíte tem 247 e não pode quebrar).

---

### Task 1: Tutoriais de Clientes e CRM

**Files:**
- Create: `src/app/admin/tutoriais/clientes/page.js`
- Create: `src/app/admin/tutoriais/crm/page.js`

**Conteúdo:** seções "Clientes" e "CRM" da spec. **Use os pontos de lá como o esqueleto** — eles são o que o tutorial precisa dizer.

- [ ] **Step 1: Tutorial de Clientes**

Título: "Clientes: o cadastro que preenche contrato e nota". Subtítulo dizendo que cadastrar uma vez evita redigitar em todo contrato e toda nota.

"Antes de começar": só o nome é obrigatório; o resto se completa depois.

Passos: (1) abrir e cadastrar; (2) por que o endereço vem em partes; (3) a ficha e os carros; (4) usar no contrato e na nota; (5) desativar em vez de apagar.

O `warning` do "Salvar como cliente" sem endereço, e um `tip` sobre o CPF poder ser digitado com ou sem pontos.

Ao falar do papel de quem acessa, seja preciso: **cadastrar e editar é da secretaria e do financeiro; o vendedor escolhe um cliente já cadastrado ao gerar contrato, mas não vê o menu.**

- [ ] **Step 2: Tutorial do CRM**

Título: "CRM: acompanhar as oportunidades de venda". Subtítulo dizendo que é feito para usar no celular.

"Antes de começar": explique o funil em uma frase — Novo → Em contato → Proposta → Negociação → Ganho, com Perdido como saída lateral.

Passos: (1) a lista agrupada por etapa e o card inteiro clicável; (2) a tela da oportunidade e o botão que diz para onde vai; (3) chamar no WhatsApp; (4) perder (não apaga, tem motivo, dá para reabrir); (5) registrar a venda; (6) mover e remover.

O `danger` do "Registrar a venda" está escrito na spec — **use as três consequências como estão lá**, incluindo a da receita no Financeiro.

Um `tip` explicando por que cada ação é uma tela: é para funcionar no celular, em pé, sem errar o toque.

- [ ] **Step 3: Build e commit**

```bash
npm run build && npm test
git add src/app/admin/tutoriais
git commit -m "docs: tutoriais de Clientes e CRM"
```

---

### Task 2: Tutoriais de Notas Fiscais e Funcionários

**Files:**
- Create: `src/app/admin/tutoriais/fiscal/page.js`
- Create: `src/app/admin/tutoriais/funcionarios/page.js`

**Conteúdo:** seções "Notas Fiscais" e "Funcionários" da spec.

- [ ] **Step 1: Tutorial de Notas Fiscais**

Título: "Notas Fiscais: emitir a NF-e da venda". Subtítulo deixando claro que é a nota modelo 55, emitida direto do painel.

**O primeiro passo tem que responder de onde a nota nasce**: do veículo marcado como **vendido**. Foi a dúvida do primeiro uso real — quem procura um botão "nova nota" em branco não acha, porque não existe.

Passos: (1) o carro precisa estar vendido e com chassi; (2) conferir os valores (e o custo de aquisição vindo do financeiro); (3) o destinatário vindo do cadastro de clientes, com a conferência obrigatória; (4) emitir e acompanhar o status; (5) cancelar.

O `danger`: **cancelamento só nas primeiras 24h**.

Um `warning` sobre o custo de aquisição: quando o financeiro já tem a compra lançada, aquele valor manda e o que estiver na tela é ignorado — de propósito, para a base do ICMS não ser escolhida na hora da emissão.

- [ ] **Step 2: Tutorial de Funcionários**

Título: "Funcionários: ficha, admissão e saída". Subtítulo dizendo que é o cadastro das pessoas, separado do acesso ao sistema.

Passos: (1) criar a ficha; (2) registrar a admissão; (3) dar acesso ao sistema (ou ligar um login que já existe); (4) registrar a saída; (5) readmitir.

Os pontos da spec que precisam estar escritos: ficha e login são independentes; readmissão mantém as passagens anteriores; desligar desativa o login na mesma ação; só administrador acessa.

- [ ] **Step 3: Build e commit**

```bash
npm run build && npm test
git add src/app/admin/tutoriais
git commit -m "docs: tutoriais de Notas Fiscais e Funcionários"
```

---

### Task 3: Atualizar Estoque e Documentos, e o índice

**Files:**
- Modify: `src/app/admin/tutoriais/estoque/page.js`
- Modify: `src/app/admin/tutoriais/documentos/page.js`
- Modify: `src/app/admin/tutoriais/page.js`

- [ ] **Step 1: Estoque ganha ano/modelo e chassi**

**Leia o arquivo inteiro antes** e encaixe onde fizer sentido no fluxo que já existe — não empilhe no fim.

Ano de fabricação e ano do modelo: preencher os dois mostra `2021/2022` no site, no estoque e no contrato; **deixar o modelo em branco quando for igual** faz aparecer um ano só; o modelo **nunca é anterior** ao de fabricação e o sistema recusa.

Chassi: obrigatório para emitir nota fiscal; sem ele a tela de emissão barra.

- [ ] **Step 2: Documentos ganha o cliente e os documentos gerados**

**Leia o arquivo inteiro antes.** Acrescente: escolher o cliente preenche a ficha dele; escolher cliente e carro liga os dois (o carro entra na ficha do cliente com o papel do contrato); "Salvar como cliente" cadastra quem foi digitado à mão, sem o endereço; todo contrato fica guardado em Documentos gerados e no dossiê do veículo.

O `warning` sobre compra × venda: são contratos diferentes e são confundidos. **Aponte para o guia que já existe** em `/admin/documentos/guia` — não repita o conteúdo dele aqui.

- [ ] **Step 3: O índice**

Em `src/app/admin/tutoriais/page.js`, acrescente os quatro cards novos e **reordene** para o dia a dia:

`Estoque, CRM, Clientes, Documentos, Notas Fiscais, Financeiro, Gerar Criativos, Tabela FIPE, Funcionários`

Ícones, para casar com o menu lateral: CRM 🤝, Clientes 🧑, Notas Fiscais 🧾, Funcionários 🧑‍🔧.

Descrições de uma linha, no tom das que já existem.

- [ ] **Step 4: Conferir que todo link abre**

Rode:

```bash
grep -rhoE 'href="/admin[^"]*"' src/app/admin/tutoriais | sort -u
```

Para **cada** caminho da lista, confirme que existe o `page.js` correspondente em `src/app/`. Cole a lista no relatório com o veredito de cada um. Link quebrado em tutorial é o erro mais provável desta entrega.

- [ ] **Step 5: Build e commit**

```bash
npm run build && npm test
git add src/app/admin/tutoriais
git commit -m "docs: tutoriais de Estoque e Documentos atualizados, e índice reordenado"
```

---

## Depois das tasks (com o controlador)

1. Revisão final: conteúdo correto (nada inventado), links vivos, sem classe nova.
2. Navegador em largura de celular: as sete páginas abrem e são legíveis.
3. Merge e deploy (nenhum schema muda; rodar os `.sql` por hábito antes do build).
