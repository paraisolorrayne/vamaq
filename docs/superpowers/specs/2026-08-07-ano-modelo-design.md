# Ano de fabricação e ano do modelo

**Data:** 2026-08-07 · **Status:** aprovado, pronto para plano de implementação

## O problema

O cadastro tem um ano só (`vehicles.year`, `integer not null`). Seminovo no Brasil
se anuncia com dois: **fabricação/modelo**, `2021/2022`. O ano do modelo mais novo
vale dinheiro na negociação, e o anúncio que mostra um ano só parece desatualizado.

Nos contratos o rótulo já diz "Ano Fabricação / Modelo" e o campo é texto livre —
dá para digitar `2021/2022` na mão hoje. O que falha é o preenchimento automático,
que manda só o ano de fabricação.

## Decisão de arquitetura

**Duas colunas inteiras, não um campo de texto.** `year` continua sendo o ano de
fabricação, sem mudança nenhuma; entra `ano_modelo integer null`.

Um campo de texto `"2021/2022"` quebraria quatro coisas de uma vez: os filtros e a
ordenação do acervo (`year >= $1`, `sort((a,b) => b.year - a.year)`), a restrição
`year between 1950 and 2035`, a geração do slug, e todas as linhas existentes, que
precisariam de migração. Com duas colunas, **nada do que existe muda de
comportamento** e o veículo sem ano de modelo preenchido continua exibindo um ano
só, exatamente como hoje.

**`ano_modelo` é opcional.** Ninguém é obrigado a recadastrar a frota.

## Modelo de dados

Em `db/schema.sql`, no bloco de `alter table ... add column if not exists` que o
arquivo já usa para evoluir a tabela:

```sql
alter table vehicles add column if not exists ano_modelo integer;
```

Mais uma constraint de tabela (o padrão `do $$ ... pg_constraint` já usado em
`db/clientes-schema.sql`, porque `add constraint if not exists` não existe no
Postgres):

```sql
constraint ano_modelo_check
  check (ano_modelo is null or (ano_modelo between 1950 and 2036 and ano_modelo >= year))
```

O ano do modelo **nunca é anterior ao de fabricação** — é a única regra que o
banco precisa garantir. Não limitamos a `year + 1`: existe carro fabricado em
dezembro com modelo dois anos à frente, e uma trava esperta aqui vira suporte
depois. O teto vai a 2036 porque o modelo pode ser um ano além do teto de
fabricação.

## Como o ano é exibido

Uma função pura, `src/lib/anoVeiculo.js`:

- sem `ano_modelo`, ou com `ano_modelo` igual a `year` → `"2021"`
- com `ano_modelo` diferente → `"2021/2022"`
- sem `year` → string vazia

A regra "igual não repete" importa: `2022/2022` é ruído. Quem cadastra os dois
iguais quer dizer "é o mesmo ano", e a tela deve mostrar `2022`.

## Onde aparece

**No painel:** o formulário de veículo ganha **"Ano do modelo"** ao lado de "Ano de
fabricação" (o rótulo do campo atual muda de "Ano" para "Ano de fabricação"). A
lista do estoque e o card mobile passam a mostrar a forma composta.

**No contrato:** `fillFromVehicle` passa a preencher `${prefix}_ano` com a forma
composta. O campo continua texto livre e editável.

**No site público:** card do acervo, página do veículo, título do Google e a
mensagem pronta de WhatsApp.

**Fora de escopo por decisão:** as artes de divulgação (Gerar Criativos) e a
descrição do item da NF-e. A descrição da nota é uma string que a SEFAZ já aceitou
nas notas emitidas; mexer nela pede uma conversa com o contador antes, e não vale
travar esta entrega por isso.

## O que NÃO muda

- **Filtros e ordenação do acervo** continuam usando `year` (fabricação). Um
  `2021/2022` continua aparecendo para quem filtra "até 2021". Mudar isso alteraria
  o resultado do filtro para um acervo que já está no ar.
- **O slug.** Ele é montado só na criação, a partir de `brand-model-year`, e nunca
  é recalculado na edição — as URLs já indexadas ficam intactas por construção. O
  ano do modelo não entra nele.
- **A FIPE.** Já usa um código de ano próprio, desacoplado do cadastro.
- **A NF-e.** Ver acima.

## Testes

`src/lib/anoVeiculo.js` é puro e sem imports, no padrão de `cpf.js`, `payload.js` e
`buscaVeiculo.js` — o alias `@/` não resolve em `node --test`. Casos: sem ano de
modelo; com ano de modelo diferente; com ano de modelo igual ao de fabricação (não
repete); sem ano nenhum; valores em string vindos do formulário.

A constraint nova ganha teste de schema contra Postgres real, no padrão de
`tests/clientes-schema.test.mjs`: `ano_modelo` nulo é aceito; anterior ao de
fabricação é recusado; fora da faixa é recusado; igual ao de fabricação é aceito.

O resto é tela, verificado por `npm run build` e roteiro no navegador — incluindo
conferir que um veículo **sem** `ano_modelo` continua exibindo exatamente o que
exibia antes, em todas as telas tocadas.
