# O carro vendido que volta na troca

**Data:** 2026-09-17 · **Status:** aprovado, pronto para implementação

## O problema, descoberto pela Mayra

Áudio de 17/09/2026:

> "Tem um carro que o Mateus vendeu, aí eu fui lá, marquei como vendido e emiti a
> nota de venda. Agora ele tá voltando pra gente — pegou na negociação de volta,
> vendeu outro carro. Aí, pra ele poder aparecer aqui no estoque, tá como vendido,
> não tem como eu voltar, né? Eu vou ter que fazer um novo cadastro desse veículo."

Recadastrar significa redigitar placa, chassi, RENAVAM, fotos e documentos de um
carro que já está no sistema — e ficar com duas linhas da mesma placa aparecendo
lado a lado na busca do Estoque, que não filtra por status.

## Por que o sistema empurra para o recadastro

Não é só o status. **O sistema inteiro assume que uma linha de `vehicles` é um
ciclo de compra e venda**, e o recadastro é a única forma de abrir um ciclo novo.

Três lugares onde esse invariante está escrito:

1. **`notas_fiscais`** — um `vehicle_id` só aceita uma nota de cada operação.
   `notas.js:380` responde *"Este veículo já tem nota de entrada autorizada.
   Cancele a atual antes de emitir outra"*, e `notas.js:67` barra a segunda nota de
   saída. Mesmo com o carro de volta ao estoque, a segunda venda travaria aqui.
2. **`vehicles.data_entrada` / `data_saida`** — uma coluna para cada. Um segundo
   ciclo sobrescreveria as datas do primeiro, e o relatório de entradas e saídas
   perderia a compra original.
3. **`fin.v_vehicle_margin`** — agrupa por `v.id`. Duas negociações na mesma linha
   virariam uma margem só.

Confirmado com a Lorrayne (17/09): o carro que volta na troca **é uma nova
aquisição** — nota de entrada própria, custo próprio, e a próxima nota de venda
cita essa nova entrada. São dois ciclos, não um.

## A decisão: ciclo versionado na mesma linha

`vehicles` ganha um `ciclo`, e as notas e os lançamentos passam a nascer carimbados
com o ciclo do carro. "Voltar ao estoque" fecha o ciclo corrente e abre o próximo.

**Um carro continua sendo um cadastro.** Fotos, documentos, RENAVE, slug e histórico
seguem intactos, e a busca por placa devolve um resultado.

**A alternativa descartada** foi criar um cadastro novo ligado ao anterior
(`veiculo_anterior_id`). Tem risco fiscal zero — cada linha continua sendo um ciclo,
que é o que o sistema já assume — e daria margem e relatório corretos de graça. Foi
recusada porque não resolve o que a Lorrayne pediu: as duas linhas da mesma placa
continuariam visíveis na busca do admin.

**O risco fiscal se dissolve no `default 1`.** Para todo carro e toda nota que
existem hoje o ciclo é 1, e as guardas passam a comparar `1 = 1` — comportamento
idêntico ao de agora. Nenhuma nota emitida é tocada, nada é cancelado.

## Schema

Arquivo novo `db/estoque-ciclo.sql`, re-aplicável como os irmãos.

```sql
alter table vehicles         add column if not exists ciclo int not null default 1;
alter table notas_fiscais    add column if not exists ciclo int not null default 1;
alter table fin.transactions add column if not exists ciclo int not null default 1;

create index if not exists notas_fiscais_veiculo_operacao_ciclo_idx
  on notas_fiscais(vehicle_id, operacao, ciclo);

-- Os ciclos já encerrados. O corrente vive em vehicles; sem esta tabela, a
-- primeira compra do carro sumiria do relatório de entradas e saídas.
create table if not exists vehicle_ciclos (
  id            uuid primary key default gen_random_uuid(),
  vehicle_id    uuid not null references vehicles(id) on delete cascade,
  ciclo         int  not null,
  data_entrada  date,
  data_saida    date,
  price         numeric(12,2),
  encerrado_em  timestamptz not null default now(),
  encerrado_por uuid references users(id),
  unique (vehicle_id, ciclo)
);
```

### O carimbo é trigger, não código de aplicação

`before insert` em `notas_fiscais` e `fin.transactions` copia o ciclo do veículo
(só quando `vehicle_id` não é nulo — em `fin.transactions` ele é opcional).

Hoje são três pontos de inserção de nota (`notas.js:189`, `:403`, `:522`) e dois de
lançamento (`finance.js:159`, `asaas/cobranca.js:98`). Com trigger, nenhum deles
pode esquecer o carimbo — nem os que forem escritos depois. É a mesma razão pela
qual `data_saida` é carimbada no `update` de status e não pedida à operadora.

## A ação "Voltar ao estoque"

**A regra, pura:** `src/lib/estoque/retornoVeiculo.js`, espelhando `vendaVeiculo.js`
— sem imports, para rodar em `node --test`, onde o alias `@/` não resolve.

```js
podeRetornarAoEstoque(veiculo)  // verdadeiro só com status === "vendido"
```

Só `vendido` volta. Carro `disponivel` ou `reservado` nunca saiu; `inativo` tem o
caminho próprio (*Reativar*), que não abre ciclo novo — desativar não é vender.

**A escrita:** `retornarAoEstoque(id, userId)` no `vehicleStore`, numa transação com
`select ... for update`:

1. reconfere o status sob o lock — a tela é alcançável por link salvo, e dois
   cliques simultâneos abririam dois ciclos;
2. grava o ciclo que fecha em `vehicle_ciclos` (entrada, saída e preço de venda);
3. `ciclo = ciclo + 1`, `status = 'disponivel'`, `data_entrada = current_date`,
   `data_saida = null`, `published = true`.

O passo 3 é um `update` próprio, **não** uma chamada a `setVehicleStatus`: os quatro
campos e a linha de histórico têm que cair na mesma transação do lock, e
`setVehicleStatus` abriria a sua. `setVehicleStatus` segue existindo inalterado para
as outras transições — ganha só o `republicar`, descrito adiante.

O preço antigo fica como estava: é ponto de partida para a reprecificação, não um
número que o sistema deva adivinhar. A data de entrada é hoje — é a data da nova
aquisição, e é dela que a coluna "Qtd dias" da lista de estoque passa a contar.

## As guardas fiscais

Em `src/lib/fiscal/notas.js`, quatro consultas passam a ser por ciclo corrente:

| Linha | O que faz | Sem o ciclo |
|---|---|---|
| `:67` | barra a segunda nota de saída | a segunda venda não emite |
| `:380` | barra a segunda nota de entrada | a nova aquisição não emite |
| `:484` | devolução de consignação | olha a entrada do ciclo errado |
| `:76` | acha o `numeroNotaEntrada` | **o pior** — ver abaixo |

A quarta é a que mais importa e a menos óbvia. O texto obrigatório da nota de venda
cita o número da nota de entrada do veículo (*"VEICULO USADO ADQ DE ... CF NF 10"*).
Sem o filtro por ciclo, a nota da segunda venda sairia autorizada citando a **compra
errada** — a de meses atrás, de outro vendedor. Erro silencioso, em documento fiscal
já autorizado.

## Margem — e por que ela é fiscal, não só financeira

**Correção ao levantamento inicial (17/09, durante o planejamento).** Eu havia
registrado que a margem por veículo não tinha consumidor. Meia verdade, e a metade
que falta é a perigosa:

- a **view** `fin.v_vehicle_margin` de fato não é lida por ninguém;
- mas a lógica está **duplicada** em `getVehicleMargins` (`finance.js:246-257`), com
  a mesma agregação por `v.id`, e essa função tem três consumidores.

O terceiro consumidor é `notas.js:51`. Ele tira dali o `custoAquisicao`, que vira a
**base do ICMS da nota de venda** (`impostosVeiculoUsado`). Num carro em segundo
ciclo, a soma traria junto o custo da primeira compra: **imposto calculado sobre
base errada, em nota autorizada pela SEFAZ.** É o mesmo tipo de erro silencioso da
nota de entrada citada errado, e vale a mesma prioridade.

Então o ciclo tem que chegar às duas:

- `getVehicleMargins` agrupa por `(v.id, coalesce(t.ciclo, v.ciclo))` e devolve
  `ciclo` e `ciclo_atual` em cada linha;
- `notas.js` e a tela de entradas e saídas passam a casar por **veículo + ciclo**,
  não só por veículo;
- a view acompanha a mesma agregação, para não nascer divergente da função no dia
  em que alguém a usar.

O `coalesce` cobre o carro sem lançamento nenhum, que no `left join` traria
`t.ciclo` nulo.

**Um efeito no placar de saúde financeira** (`finance.js:608`): ele conta vendidos
por `status === "vendido"`, que é o status **atual** do carro. Um carro em ciclo 2
está `disponivel`, e a venda do ciclo 1 sumiria da conta. Como todo ciclo encerrado
terminou em venda, a regra passa a ser `status === "vendido" || ciclo < ciclo_atual`.

O relatório de entradas e saídas passa a unir o ciclo corrente, de `vehicles`, com
os encerrados, de `vehicle_ciclos`.

## A tela

Botão **"Voltar ao estoque"** na linha do carro vendido, ao lado de *Emitir nota*.

A confirmação diz o que vai acontecer, **incluindo a parte fiscal** — é a informação
que a Mayra não tem como adivinhar e a que mais custa caro se faltar:

> O carro volta como **disponível** e volta para o site, com entrada de hoje. A venda
> anterior fica no histórico. A próxima venda vai exigir uma **nova nota de entrada**.

Na ficha do veículo, quando `ciclo > 1`, os ciclos anteriores aparecem com entrada,
saída e preço — senão o carro parece ter chegado hoje, sem passado.

## O `published` que não volta

Defeito que já existe, achado no caminho: `setVehicleStatus` só mexe em `published`
para **tirar** do ar (`vehicleStore.js:187`). *Reativar* devolve o carro ao estoque
como `disponivel`, mas ele **não volta para o site** — e ninguém avisa.

O conserto não é "toda volta para `disponivel` republica": o cadastro tem uma caixa
`published` própria (`estoque/novo/page.js:627`), então "disponível e fora do site" é
um estado que alguém escolhe de propósito, e forçar a republicação atropelaria essa
escolha.

`setVehicleStatus` ganha um parâmetro `republicar`, passado só pelas duas ações em
que a pessoa declarou a intenção: **Reativar** e **Voltar ao estoque**.

## Testes

- **`tests/estoque-retorno.test.mjs`** — `podeRetornarAoEstoque` nos quatro status.
- **`tests/estoque-ciclo-schema.test.mjs`** — o `.sql` traz as colunas com
  `default 1`, a tabela, o índice e os dois triggers; mesmo padrão dos
  `*-schema.test.mjs` existentes.
- **Fiscal, o caso que importa:** carro no ciclo 2 aceita nova nota de entrada, e a
  nota de venda desse ciclo cita o número da entrada **do ciclo 2**; o ciclo 1
  segue bloqueado exatamente como hoje.

## Fora de escopo, de propósito

- **Desfazer um retorno.** Se ela clicar por engano, o conserto é marcar vendido de
  novo — o ciclo extra fica no histórico. Um "cancelar retorno" precisaria decidir o
  que fazer com nota emitida no ciclo novo, e não há caso real ainda.
- **Ligar o retorno à venda do outro carro.** A troca que trouxe este carro de volta
  é uma negociação no CRM; amarrar as duas é assunto do CRM, não do Estoque.
- **Lançar o custo da reaquisição no financeiro.** Continua manual, como em toda
  compra — o retorno não inventa lançamento.
