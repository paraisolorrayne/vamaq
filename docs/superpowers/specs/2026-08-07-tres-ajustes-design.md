# Três ajustes: emitir nota, foto no mobile, buscar por placa

**Data:** 2026-08-07 · **Status:** aprovado, pronto para plano de implementação

## Por que estes três juntos

São ajustes pequenos e independentes, todos nascidos de uso real do painel logo
depois que a emissão de NF-e entrou em produção. Nenhum deles muda modelo de
dados; os três são de tela.

---

## 1. Porta de entrada para emitir a nota

**Problema.** A emissão começa no **Estoque**, no carro marcado como *vendido* —
é lá que aparece o link "Emitir nota". A tela **Notas Fiscais** é só a lista do
que já saiu. Quem vai emitir procura onde é natural procurar (Notas Fiscais) e
não encontra caminho nenhum. Foi o que aconteceu no primeiro uso real.

**Decisão.** A tela de Notas Fiscais ganha um botão **"Emitir nota"** que abre um
seletor com os veículos **vendidos** e leva à tela de conferência daquele carro.

- O botão aparece **só com a integração ativa** (`focusEnabled()`), coerente com
  o resto da tela, que hoje esconde as ações quando o emissor não está ativado.
- **Sem nenhum veículo vendido:** o seletor não aparece; no lugar, a frase
  "Nenhum veículo vendido no momento — a nota nasce da venda." Isso ensina a
  regra em vez de deixar o operador procurando.
- O caminho pelo Estoque **continua existindo**, sem mudança.

## 2. Criativos: foto principal antes do veículo no mobile

**Problema.** No painel de edição os blocos vêm na ordem *Veículo* → *Foto
principal*. Em tela estreita a pré-visualização pula para o topo, e o bloco da
foto — que é o que mais conversa com o que está sendo visto — fica empurrado
para baixo do formulário do veículo.

**Decisão.** Em coluna única, **Foto principal** vem antes de **Veículo**.

O corte é **1020px**, que é exatamente onde o layout deixa de ser duas colunas e
a pré-visualização ganha `order: -1`. Assim tablet e celular se comportam igual,
e no desktop nada muda.

Implementação: `.creativePanel` já é `flex-direction: column`, então basta dar
`order` aos dois cartões dentro da media query que já existe. São duas regras
novas no CSS compartilhado — a restrição de "sem CSS novo" existe para não
inventar design paralelo, e aqui o CSS **é** o mecanismo.

## 3. Achar o carro pela placa

**Problema.** A busca do estoque filtra por `marca modelo cor` — **placa não
entra**. Digitar a placa hoje não acha nada, embora seja o jeito mais natural de
procurar um carro específico.

**Decisão.** Duas partes:

**(a) A placa passa a valer na busca do estoque.** A comparação ignora maiúsculas
e **descarta o que não for letra ou número** dos dois lados, para que `ABC-1D23`,
`abc1d23` e `ABC1D23` achem o mesmo carro. Sem isso, o hífen que a pessoa digita
por hábito quebra a busca.

**(b) Atalho no Dashboard.** Em *Ações Rápidas* entra um campo **"Buscar por
placa"**. Enviando, vai para `/admin/estoque?busca=<placa>`, e a lista de estoque
passa a aceitar esse parâmetro inicializando o filtro.

Esse desenho resolve os três casos sem código extra: nenhum resultado mostra a
mensagem que a lista já tem; um resultado deixa o carro sozinho na tela, a um
clique do cadastro; vários resultados deixam o operador escolher.

**Fora de escopo, por decisão:** página de histórico consolidada do veículo
(linha do tempo com contratos, notas, RENAVE, CRM e margem). Fica como entrega
própria, com desenho próprio.

## Testes

Nada aqui tem lógica testável sem tela: são ordem de blocos, um filtro de texto e
um seletor de navegação. **Exceção:** a normalização da busca (ignorar maiúsculas
e pontuação) é uma função pura e ganha teste próprio — é a única parte onde um
erro passa despercebido, e é a que decide se a busca acha ou não o carro.

O resto é verificado por `npm run build` mais roteiro no navegador, incluindo
**largura de celular** para o item 2, que só se manifesta lá.
