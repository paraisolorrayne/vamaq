# CRM: redesenho 100% mobile

**Data:** 2026-08-07 · **Status:** aprovado, pronto para plano de implementação

## A regra que governa tudo

**Toda ação é uma tela.** Sem popup, sem modal, sem gaveta, sem `confirm()`,
sem `prompt()`, sem `alert()`, sem botão pequeno. Qualquer coisa clicável tem
**no mínimo 48px de altura** e, quando é ação principal, ocupa a largura toda.

Não é preferência estética: o vendedor usa isso em pé, no pátio, com o celular
numa mão e a chave do carro na outra.

## O que o CRM tem hoje, e por que precisa ser reescrito

O arquivo `src/app/admin/crm/page.js` viola a regra em seis lugares:

| Onde | O quê |
|---|---|
| `move()` | `prompt("Motivo da perda…")` |
| `registrarVenda()` | `confirm(...)` e depois `alert(...)` |
| `remove()` | `confirm(...)` |
| Rodapé do card | `✎` e `✕` — dois botões de ícone minúsculos |
| Rodapé do card | `<select>` de etapa espremido dentro do card |
| Layout | quadro de 6 colunas com rolagem horizontal |

Some-se a isso o formulário que aparece e some no meio da página (`showForm`),
que não é modal mas também não é tela.

## Bug de acesso, encontrado ao levantar o terreno

**A secretaria enxerga o CRM no menu e não consegue usar.** `permissions.js`
dá a seção `crm` a `["vendedor", "secretaria"]`, mas **as sete guardas** das rotas
em `src/app/api/admin/crm/` exigem `["vendedor"]`. A secretaria abre a tela e vê
um funil vazio, sem erro e sem explicação — toda requisição volta 403.

É o mesmo padrão que já mordeu o financeiro (mudar o menu sem mudar a API),
espelhado. Entra nesta entrega: as guardas passam a `["vendedor", "secretaria"]`,
alinhadas com o menu.

## As telas

Sete rotas. Cada uma faz uma coisa.

### `/admin/crm` — a lista

Rolagem vertical única, agrupada por etapa. Cabeçalho de etapa em maiúsculas com
o contador (`NOVO · 3`), e abaixo os cards daquela etapa, um embaixo do outro,
ocupando a largura toda.

Cada card mostra **nome do cliente**, **veículo**, **valor** e **origem**, e o
card **inteiro é o alvo do toque** — não há botão dentro dele. Tocar leva à tela
do card.

Etapa sem nenhum card não aparece — o funil não deve ter buracos visuais. Se não
houver nenhuma oportunidade, uma frase única e o botão de criar.

No topo, um botão de largura total **"+ Nova oportunidade"**.

### `/admin/crm/novo` e `/admin/crm/[id]/editar` — o formulário

Os mesmos campos de hoje (cliente, telefone, e-mail, veículo, valor, origem,
observações), um por linha, em tela cheia. Botão **Salvar** de largura total no
fim; **Cancelar** volta.

### `/admin/crm/[id]` — a tela do card

O centro de tudo. Mostra o cliente, a etapa atual em destaque, o veículo, o
valor, a origem, o telefone e as observações. Abaixo, as ações, cada uma um botão
de largura total:

1. **"Avançar para «próxima etapa»"** — o nome da etapa por extenso, nunca "avançar"
   sozinho. Some quando a oportunidade está em `ganho` ou `perdido`.
2. **"Chamar no WhatsApp"** — só aparece quando há telefone. Abre o WhatsApp com
   uma mensagem já escrita citando o veículo.
3. **"Registrar a venda"** — só em `ganho` e só com veículo ligado. Leva à tela de
   confirmação.
4. **"Marcar como perdido"** — leva à tela do motivo. Some quando já está perdido.
5. **"Reabrir"** — só em `perdido`, devolve para `novo`.

Embaixo, uma linha com **Editar · Mover · Remover**. São três alvos de 48px de
altura dividindo a largura em três — a linha inteira é área clicável, não são
links de texto.

### `/admin/crm/[id]/mover` — mover para qualquer etapa

Fora do caminho comum, para corrigir engano ou voltar etapa. As seis etapas como
botões de largura total; a atual aparece marcada e desabilitada. Escolher
`perdido` aqui redireciona para a tela do motivo, em vez de gravar sem ele.

### `/admin/crm/[id]/perder` — o motivo da perda

Substitui o `prompt()`. Um campo de texto grande para o motivo (opcional, como
hoje) e o botão **"Marcar como perdido"**. Acima, uma linha dizendo que a
oportunidade continua na lista, em Perdido, e pode ser reaberta — para a pessoa
não achar que está apagando.

### `/admin/crm/[id]/vender` — registrar a venda

Substitui o `confirm()` e o `alert()`. Mostra cliente e veículo por extenso e,
antes do botão, **o que vai acontecer**:

- o carro é marcado como **VENDIDO**;
- ele **sai do site na hora**;
- a receita **não** é lançada sozinha — tem que ser feita no Financeiro, ligada ao
  veículo, senão a margem não sai.

Esse terceiro item hoje é um `alert()` que aparece **depois** de a venda já estar
registrada, quando não dá mais para agir. Na tela ele aparece antes.

### `/admin/crm/[id]/remover` — remover

Substitui o `confirm()`. Diz que a oportunidade some de vez, que isso **não** mexe
no veículo nem em nada do financeiro, e sugere "Marcar como perdido" para quem só
quer tirar do funil sem perder o histórico. Botão de confirmar em vermelho.

## Desktop

As mesmas telas. A lista ganha os cards em grade de duas ou três colunas dentro
de cada grupo de etapa, e as telas de ação ficam com largura máxima confortável em
vez de esticar. **Não volta o quadro horizontal** — uma tela só, que funciona nos
dois, vale mais que duas para manter.

## O que não muda

- **O banco.** `oportunidades` já tem tudo (`etapa`, `motivo_perda`,
  `responsavel_id`). Nenhuma coluna nova.
- **A API.** `GET`, `PUT`, `PATCH` (etapa e `registrar-venda`) e `DELETE` já fazem
  o necessário. Muda **só a lista de papéis** das guardas.
- **As regras de negócio.** Registrar venda continua marcando o veículo como
  vendido; a etapa continua restrita pelo `CHECK` do banco.

## Fora de escopo, por decisão

- Filtrar por responsável ("só o que é meu"). A coluna `responsavel_id` existe e
  fica pronta para isso, mas a loja tem poucos vendedores e o filtro só
  adicionaria uma decisão a cada abertura.
- Histórico de mudanças de etapa (quem moveu, quando).
- Busca por nome. Com o volume atual a rolagem resolve; com busca, viraria mais um
  campo pequeno no topo.

## Testes

A lógica testável é pura e vai em `src/lib/crm/etapas.js`, sem imports (o alias
`@/` não resolve em `node --test`):

- `proximaEtapa(etapa)` — devolve a próxima do funil, ou `null` em `ganho` e
  `perdido`. Testes: cada etapa da sequência; as duas terminais devolvendo `null`;
  etapa desconhecida devolvendo `null`.
- `rotuloEtapa(etapa)` — o nome por extenso para a tela. Teste: as seis, mais
  etapa desconhecida devolvendo o próprio valor em vez de vazio.
- `acoesDaEtapa(oportunidade)` — quais ações aparecem. É a regra mais fácil de
  errar e a que mais dói: "Registrar a venda" aparecendo sem veículo ligado leva a
  um botão que falha. Testes: em `novo` (avançar sim, vender não); em `ganho` com
  veículo (vender sim, avançar não); em `ganho` **sem** veículo (vender não); em
  `perdido` (só reabrir); WhatsApp só com telefone.

O resto é tela, verificado por `npm run build` e roteiro no navegador **em largura
de celular** — que é o ponto da entrega — incluindo a conferência de que nenhum
alvo clicável tem menos de 48px de altura.

E uma verificação que esta entrega exige por causa do bug encontrado: **abrir o
CRM logado como secretaria** e confirmar que ela cria, move e edita.
