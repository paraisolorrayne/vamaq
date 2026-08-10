# CRM ligado ao cadastro de clientes

**Data:** 2026-08-09 · **Status:** aprovado, pronto para plano de implementação

## O problema

O CRM guarda `cliente_nome` como **texto livre** e não conhece a tabela `clientes`.
Três consequências reais:

- a mesma pessoa é digitada de novo a cada oportunidade;
- **um carro vendido pelo CRM não aparece na ficha do cliente** — o vínculo
  `cliente_veiculos` só nasce ao gerar contrato ou emitir nota;
- o funil não sabe que aquele lead já comprou dois carros antes.

Ficou de fora da entrega do cadastro de clientes de propósito, porque o CRM ia ser
reescrito. Ele foi.

## Decisões

**`oportunidades` ganha `cliente_id`, opcional.** `cliente_nome` **continua
existindo** e continua sendo o que aparece na tela quando não há vínculo — nada
que já está gravado quebra, e o vendedor nunca fica travado esperando cadastro.

**O vendedor passa a poder cadastrar cliente, mas só de dentro do CRM.** Ele já
podia **listar** clientes (é o que alimenta o seletor do contrato); agora ganha
**criar**. Não ganha a tela de Clientes, nem a ficha, nem editar, nem desativar —
isso continua sendo de secretaria, financeiro e admin, como já estava decidido.

> Criar no fluxo onde a pessoa está; administrar em outro lugar. A assimetria é
> deliberada: o vendedor no pátio precisa registrar um lead agora, e não deveria
> depender de alguém; mas corrigir, editar e desativar cadastro é trabalho de quem
> cuida da papelada.

**Achar tem que ser mais fácil que criar.** É a proteção contra o risco que a
liberação abre — cadastro duplicado é o que mais suja base de cliente. Digitando o
nome no formulário da oportunidade, o sistema **busca no cadastro e mostra quem já
existe**; "cadastrar como cliente novo" é o que sobra quando nada casou. O CPF
único já barra o duplicado exato; o que essa busca evita é o duplicado por
digitação ("Carlos Mendes" e "Carlos Mendez").

**Nada de casar por nome automaticamente.** Dois "José Silva" viram um só e o
histórico de carros mistura duas pessoas. As oportunidades que já existem ficam
como estão e são vinculadas à mão, quando alguém quiser.

## O que muda

### Banco

```sql
alter table oportunidades add column if not exists cliente_id uuid;
-- on delete set null: apagar o cadastro do cliente não pode apagar a oportunidade
```

Mais a FK no padrão `do $$ ... pg_constraint` que o projeto usa, e índice em
`cliente_id`.

`cliente_nome` **continua `not null`** — é o rótulo de exibição e a memória do que
foi digitado. Ao vincular um cliente, o nome dele é copiado para lá, de modo que a
lista continua legível sem join.

### A venda pelo CRM passa a ligar o carro ao cliente

Hoje `registrar-venda` marca o veículo como vendido e para por aí. Passa a criar
também o vínculo `cliente_veiculos` com papel **`comprou`** e origem **`crm`** —
quando a oportunidade tiver `cliente_id` **e** `vehicle_id`.

Isso exige um valor novo no `check` de `origem` da tabela `cliente_veiculos`, que
hoje aceita `manual`, `contrato` e `nota`.

Como nos outros dois caminhos, o vínculo vai em `try/catch` que só registra o erro:
**uma venda registrada não pode virar erro porque o vínculo falhou**. E o
`on conflict` já existente cuida de o mesmo par não duplicar quando a venda também
gerar contrato ou nota.

### Telas do CRM

- **Formulário da oportunidade:** o campo de cliente vira busca. Digitando, mostra
  os clientes que casam por nome, CPF ou telefone. Escolher preenche nome, telefone
  e e-mail e guarda o `cliente_id`. Não achou nada e o nome está preenchido:
  aparece **"Cadastrar «nome» como cliente novo"**, que cria o cadastro mínimo e já
  vincula.
- **Tela da oportunidade:** quando há cliente vinculado, o nome vira link para a
  ficha dele, com uma linha discreta dizendo há quantos carros ele passou. Sem
  vínculo, aparece a ação **"Vincular a um cliente"**, que leva a uma tela própria
  de busca — como manda a regra do CRM, toda ação é uma tela.
- **Lista:** oportunidade sem cliente cadastrado ganha uma marca discreta, para a
  secretaria saber o que falta vincular. Discreta de propósito — não é erro, é
  pendência.

### Ficha do cliente

Ganha um bloco **"Oportunidades"**, com etapa, veículo e valor, ao lado dos blocos
de carros, contratos e notas que já existem. É o outro lado do mesmo vínculo.

## O que não muda

- Nenhuma oportunidade existente é migrada ou alterada.
- `cliente_nome` continua obrigatório e continua sendo o que a lista mostra.
- A tela de Clientes segue fora do alcance do vendedor.
- As regras do funil (`acoesDaEtapa`) não mudam.

## Testes

Lógica pura, sem imports, no padrão da casa:

- `dadosDoCliente(cliente)` — o que o seletor copia para a oportunidade (nome,
  telefone, e-mail). Casos: cliente completo; sem telefone; sem e-mail; nulo.
- `precisaVincular(oportunidade)` — decide a marca de pendência na lista.
  Casos: com `cliente_id`; sem; oportunidade nula.

Teste de schema contra Postgres real, no padrão de `tests/clientes-schema.test.mjs`:
`cliente_id` nulo é aceito; apagar o cliente deixa a oportunidade viva com
`cliente_id` nulo; e `origem = 'crm'` é aceita em `cliente_veiculos` (é a mudança de
`check`).

Teste de autorização, estendendo `tests/crm-autorizacao.test.mjs` e
`tests/clientes-autorizacao.test.mjs`: o **vendedor** passa no `POST` de clientes e
**continua barrado** em `PUT`, `PATCH`, `DELETE` e no `GET` da ficha. É a fronteira
que esta entrega move, e mover fronteira sem teste foi o que deixou a secretaria
sem CRM por meses.

O resto é tela: `npm run build` e roteiro no navegador, incluindo o caminho
completo — criar oportunidade com cliente novo pelo CRM, registrar a venda, e
conferir que o carro apareceu na ficha do cliente.
