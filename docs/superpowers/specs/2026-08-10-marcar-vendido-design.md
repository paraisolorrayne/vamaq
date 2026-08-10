# Marcar o carro como vendido pelo Estoque

**Data:** 2026-08-10 · **Status:** aprovado, pronto para implementação

## O problema, descoberto pela Mayra

A Mayra (secretária) perguntou onde emitia a nota de saída. Eu respondi "marque o
carro como vendido no Estoque" — **e esse botão não existe**. A lista do Estoque só
oferece *Desativar* e *Reativar*. O tutorial de Notas Fiscais que escrevi repete o
mesmo erro.

Hoje, no painel inteiro, **o único caminho** para um carro virar `vendido` é o CRM:
criar oportunidade → avançar até Ganho → *Registrar a venda*. Quem vendeu no balcão,
para alguém que nunca foi um lead, não tem caminho — teria que inventar uma
oportunidade retroativa só para destravar a nota fiscal.

## A decisão

**Um botão de marcar como vendido direto no Estoque, sem tirar o do CRM.** Os dois
caminhos coexistem: o CRM continua sendo o certo quando a venda nasceu de um lead;
o Estoque cobre a venda de balcão.

**A venda pelo Estoque também liga o carro à ficha do cliente.** Sem isso, metade
das vendas ficaria fora do histórico — e o histórico do cliente é o motivo de todo
o trabalho das últimas entregas. O cliente é **opcional**: quem não souber na hora
marca a venda mesmo assim e vincula depois.

## A tela

É uma tela própria, `/admin/estoque/[id]/vender`, não um `confirm()`. Marcar vendido
tira o carro do site na hora, e o mesmo aviso que a tela do CRM dá precisa aparecer
aqui.

Mostra:

- **o carro por extenso** — marca, modelo, ano (fabricação/modelo) e placa;
- **o cliente**, opcional, com a mesma busca do CRM (`SeletorCliente`) — achar tem
  que continuar sendo mais fácil que criar;
- **o que vai acontecer**, antes do botão:
  - o carro é marcado como **VENDIDO**;
  - ele **sai do site na hora**;
  - a receita **não** é lançada sozinha — registre no Financeiro, ligada a esse
    veículo, senão a margem dele não aparece.

Botão *Confirmar a venda*; *Cancelar* volta ao Estoque.

Se o carro já estiver vendido, a tela não deixa marcar de novo: diz isso e oferece
o link de emitir a nota.

## O vínculo

Quando houver cliente escolhido, cria `cliente_veiculos` com papel **`comprou`** e
origem nova **`estoque`** — do mesmo jeito que contrato, nota e CRM já fazem, e com
o mesmo `try/catch` que só registra o erro: **uma venda marcada não pode virar erro
porque o vínculo falhou**.

`origem` passa a aceitar `manual`, `contrato`, `nota`, `crm`, `estoque`. É a mesma
mudança de `check` feita para `crm`, com o mesmo cuidado: alterar o `create table`
**e** recriar a constraint nos bancos que já existem.

## Quem pode

Quem já vê o Estoque: `estoque`, `financeiro`, `vendedor`, `secretaria` (e `admin`).
Não alarga acesso nenhum — é a mesma tela que essas pessoas já usam.

**Uma frouxidão que fica corrigida junto:** o `PATCH /api/admin/vehicles/[id]`, que
muda o status, hoje exige apenas **estar logado** (`requireApiRole()` sem papel).
Ele tira carro do site; passa a exigir os mesmos quatro papéis.

## O que também estava errado e é corrigido

- **O tutorial de Notas Fiscais** manda marcar o carro como vendido no Estoque e
  aponta para o tutorial de Estoque. Passa a descrever os dois caminhos reais.
- **O subtítulo do mesmo tutorial** diz "acesso de administrador e financeiro" —
  desatualizado desde que a secretaria ganhou a seção.
- **O tutorial de Estoque** ganha o passo de marcar a venda.

## Testes

- `podeMarcarVendido(veiculo)` — puro, sem imports: verdadeiro só quando o veículo
  existe e não está `vendido` nem `inativo`. Casos: disponível; reservado; vendido;
  inativo; nulo.
- Teste de schema: `cliente_veiculos` aceita `origem = 'estoque'` e continua
  recusando origem inventada.
- O teste de permissões (`tests/permissoes-secoes.test.mjs`) já cobre quem vê o
  Estoque; acrescentar o `PATCH` de status à matriz de autorização de rotas.

Verificação no navegador: marcar uma venda de balcão com cliente e conferir que o
carro sai do site **e** aparece na ficha do cliente com origem `estoque`.
