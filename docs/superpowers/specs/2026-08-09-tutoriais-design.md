# Tutoriais das telas novas

**Data:** 2026-08-09 · **Status:** aprovado, pronto para plano de implementação

## Por que agora

Quatro módulos entraram no painel sem tutorial: **Funcionários**, **Notas
Fiscais**, **Clientes** e o **CRM reescrito**. Dois tutoriais existentes ficaram
desatualizados: **Estoque** (ganhou chassi e ano do modelo) e **Documentos**
(ganhou o seletor de cliente e a lista de documentos gerados).

Quem lê isso é o Mateus e a Louanny, no meio do expediente, com uma dúvida
concreta. Tutorial que só descreve a tela ("clique em Salvar para salvar") não
serve para nada — o valor está no que **não** é óbvio e no que já deu errado.

## O que não muda

O formato já existe e funciona: Server Component, cabeçalho, "Antes de começar",
passos numerados, e três tipos de caixa — `tip` (atalho), `warning` (cuidado),
`danger` (irreversível). Nenhuma classe nova em `tutorial.module.css`; ele já tem
`checklist`, `uiField`, `uiButton`, `modelGrid` e `math`.

## Os quatro tutoriais novos

### Clientes

O ponto que só quem construiu sabe: **o endereço é pedido em partes** (CEP,
logradouro, número, bairro, município, UF) porque é assim que a nota fiscal exige.
No contrato ele vira uma linha só, montada sozinha. Sem essa explicação, o
formulário parece burocrático à toa.

Outros pontos que precisam estar escritos:

- **Só o nome é obrigatório.** Ninguém precisa recadastrar a base inteira; o
  cadastro se completa conforme for útil.
- **O CPF pode ser digitado como quiser** — com ou sem pontos. O sistema guarda só
  os números, e a busca acha dos dois jeitos. Mas **o mesmo CPF não entra duas
  vezes**.
- **Os carros aparecem sozinhos.** Gerou contrato com o cliente selecionado, o
  carro entra na ficha dele com o papel certo (comprou, vendeu, consignou). Para os
  negócios anteriores ao sistema, dá para ligar à mão.
- **Desativar não apaga** — some da busca e volta quando quiser.
- **O vendedor não vê o menu Clientes**, mas escolhe um cliente já cadastrado ao
  gerar contrato. Quem cadastra é a secretaria ou o financeiro.

Um `warning` merecido: o botão **"Salvar como cliente"** dentro do gerador de
contrato **não leva o endereço**, porque no contrato ele é uma linha só e separar
em partes na adivinhação criaria endereço errado na nota fiscal. Quem cadastrou por
ali completa o endereço depois na ficha.

### CRM

O tutorial antigo não existe, e o fluxo mudou por inteiro. O que precisa ficar
claro:

- **Cada ação é uma tela.** Não existe mais janelinha de confirmação. Isso é
  decisão, não limitação — o CRM é usado no celular, em pé, no pátio.
- **O botão diz para onde vai:** "Avançar para Proposta", não "Avançar".
- **Ganho e Perdido são saídas**, não etapas de passagem. De Ganho não dá para
  "marcar como perdido" pelo botão principal; se a venda cair depois, o caminho é
  **Mover**.
- **Perder não apaga.** A oportunidade continua na lista, em Perdido, com o motivo,
  e pode ser reaberta. Isso precisa estar escrito porque a palavra assusta.
- **Remover apaga de vez** — e não mexe no veículo nem no financeiro.

O `danger` mais importante do tutorial inteiro, sobre **Registrar a venda**:

> Confirmar marca o carro como **vendido** e ele **sai do site na hora**. E a
> receita **não** é lançada sozinha: registre no Financeiro, ligada a esse veículo,
> senão a margem daquele carro não aparece.

### Notas Fiscais

O tutorial precisa dizer, antes de qualquer passo, **de onde a nota nasce**: do
veículo marcado como **vendido**, não de um botão em branco. Foi a dúvida do
primeiro uso real.

- **O destinatário sai do cadastro de clientes** — escolher o cliente preenche os
  oito campos. Mas **confira antes de emitir**: o que vai para a SEFAZ é o que está
  na tela.
- **O custo de aquisição manda no imposto.** Quando o financeiro já tem a compra
  lançada, aquele valor vale e o que estiver na tela é ignorado — de propósito, para
  a base do ICMS não ser escolhida na hora.
- **Sem chassi não emite.**

O `danger`: **cancelamento só dentro de 24h**. Depois disso, a nota emitida é
definitiva e o acerto é com o contador.

### Funcionários

- **A ficha é a pessoa; o login é opcional dos dois lados.** Existe funcionário sem
  acesso ao sistema, e existe acesso que ainda não foi ligado a uma ficha.
- **Readmissão mantém as passagens.** Quem sai e volta ganha uma passagem nova, e o
  histórico antigo continua lá — é isso que serve de prova depois.
- **Desligar desativa o login junto**, numa ação só. Ninguém fica com acesso ativo
  depois de sair.
- **Login que já existia pode ser ligado a uma ficha** pelo bloco "Acesso ao
  sistema" — foi feito exatamente para os acessos criados antes do módulo existir.
- Só administrador entra aqui.

## Os dois tutoriais atualizados

### Estoque

Dois campos novos, cada um com um passo curto:

- **Ano de fabricação e Ano do modelo.** Preencher os dois faz o carro aparecer
  como `2021/2022` no site, no estoque e no contrato. **Deixe o modelo em branco se
  for igual ao de fabricação** — o sistema mostra um ano só. E o modelo **nunca é
  anterior** ao de fabricação; o sistema recusa.
- **Chassi.** Obrigatório para emitir nota fiscal. Sem ele, a tela de emissão
  avisa e não deixa seguir.

### Documentos

- **Escolher o cliente preenche a ficha dele** no contrato — nome, CPF, CNH,
  endereço, telefone. Os campos continuam editáveis.
- **Escolher cliente e carro liga os dois.** Ao gerar, o carro entra na ficha do
  cliente com o papel do contrato.
- **"Salvar como cliente"** cadastra quem foi digitado à mão — sem o endereço (ver
  Clientes).
- **Todo contrato gerado fica guardado** em Documentos gerados e no dossiê do
  veículo.

Um `warning` que a memória do projeto pede: **contrato de compra e de venda são
coisas diferentes** e são confundidos com frequência. Compra é a Vamaq comprando do
cliente; venda é a Vamaq vendendo. Já existe um guia dedicado em
`/admin/documentos/guia` — o tutorial deve **apontar para ele**, não repetir.

## O índice

Quatro cards novos: Funcionários, Notas Fiscais, Clientes, CRM. A ordem do índice
passa a seguir o dia a dia, não a data de lançamento: **Estoque, CRM, Clientes,
Documentos, Notas Fiscais, Financeiro, Criativos, FIPE, Funcionários**.

## Fora de escopo

Tutorial de Usuários (a tela é de administrador e se explica sozinha) e de
Tabela FIPE (já existe e não mudou).

## Testes

Não há lógica nova — são páginas estáticas. A verificação é `npm run build` mais
roteiro no navegador conferindo que **todo link interno abre** (é o erro mais
provável: apontar para uma rota que não existe) e que as páginas cabem em largura
de celular, já que a equipe lê no telefone.
