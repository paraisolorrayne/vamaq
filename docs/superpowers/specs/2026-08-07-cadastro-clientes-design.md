# Cadastro de clientes

**Data:** 2026-08-07 · **Status:** aprovado, pronto para plano de implementação

## O problema

A mesma pessoa é redigitada do zero em quatro lugares que não se falam:

| Onde | O que guarda | Onde vive |
|---|---|---|
| Contrato | `vendedor_nome`, `vendedor_cpf`, `vendedor_cnh`, `vendedor_endereco`, `vendedor_telefone`… (e os equivalentes `comprador_*` e `proprietario_*`) | digitado a cada geração; nada é gravado além do nome em `documentos_gerados.cliente` |
| NF-e | `nome`, `doc`, `cep`, `logradouro`, `numero`, `bairro`, `municipio`, `uf` | digitado a cada emissão; gravado como jsonb em `notas_fiscais.destinatario` |
| CRM | `cliente_nome`, `telefone`, `email` | `oportunidades` |
| Financeiro | `name`, `doc`, `email`, `phone` | `fin.contacts` |

Consequências: o endereço da nota é digitado em seis campos toda vez (e um erro aí é
rejeição da SEFAZ); não existe forma de perguntar "quais carros passaram por essa
pessoa"; e o histórico do cliente só existe dentro dos PDFs.

## Decisões de arquitetura

**Tabela nova `clientes` no schema `public` — não reaproveitar `fin.contacts`.**
O schema `fin` roda com role e pool próprios (`DATABASE_URL_FIN`, `src/lib/fin/db.js`);
é a blindagem que impede o financeiro de escrever no estoque. O pool do app não
enxerga `fin`, então contratos, CRM e fiscal não conseguiriam ler `fin.contacts`, e
`documentos_gerados` não poderia ter FK para lá. Além disso `fin.contacts` não tem
endereço nem CNH. A listagem de Contatos do financeiro **fica como está** — nenhuma
migração de dados, nenhuma mudança naquelas telas.

**Endereço estruturado**, não uma linha de texto livre: CEP, logradouro, número,
complemento, bairro, município, UF. É exatamente o que a NF-e exige. Nos contratos,
que pedem uma linha só, o endereço é montado a partir das partes. Só **nome** é
obrigatório no cadastro; todo o resto é opcional, para que cadastrar não vire um
formulário intransponível.

**O vínculo cliente↔veículo é uma tabela própria**, alimentada sozinha quando um
contrato é gerado com cliente selecionado, e editável à mão para os negócios
anteriores ao sistema.

## Modelo de dados

`db/clientes-schema.sql`, idempotente, aplicado antes do build (como os demais).

### `clientes`

| coluna | tipo | nota |
|---|---|---|
| `id` | uuid pk | |
| `nome` | text not null | pessoa física ou razão social |
| `tipo` | text not null default `'pf'` | check `('pf','pj')` |
| `doc` | text | **só dígitos**; CPF (11) ou CNPJ (14) |
| `rg`, `cnh`, `cnh_categoria` | text | contratos pedem CNH; RG entra porque é pedido em cartório |
| `email`, `telefone` | text | |
| `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `municipio`, `uf` | text | destinatário da NF-e |
| `representante_nome`, `representante_cpf` | text | só faz sentido em PJ; o contrato de venda já tem esses campos |
| `obs` | text | |
| `ativo` | boolean not null default true | some da busca sem apagar histórico |
| `created_at`, `updated_at` | timestamptz | |

Índice único parcial em `doc` (`where doc is not null and doc <> ''`): dois clientes
não podem ter o mesmo CPF, mas cliente sem documento é permitido — é comum cadastrar
com o nome antes de ter o RG na mão. Índice em `lower(nome)` para a busca.

O `doc` é gravado **normalizado** (só dígitos) e exibido formatado. Sem isso,
`123.456.789-00` e `12345678900` viram dois cadastros da mesma pessoa — o mesmo erro
que a busca por placa já corrigiu no estoque.

### `cliente_veiculos`

| coluna | tipo | nota |
|---|---|---|
| `id` | uuid pk | |
| `cliente_id` | uuid not null → `clientes(id)` on delete cascade | |
| `vehicle_id` | uuid not null → `vehicles(id)` on delete cascade | |
| `papel` | text not null | check `('comprou','vendeu','consignou')` |
| `data` | date | |
| `origem` | text not null default `'manual'` | check `('manual','contrato','nota')` |
| `documento_id` | uuid → `documentos_gerados(id)` on delete set null | de onde o vínculo nasceu |
| `obs` | text | |

Único em `(cliente_id, vehicle_id, papel)`: gerar o mesmo contrato duas vezes não cria
dois vínculos. Índice em `vehicle_id` para o dossiê do veículo.

`on delete cascade` nos dois lados: o vínculo não existe sem as duas pontas. Já o
`documento_id` é `set null` — apagar um contrato não pode apagar o fato de que a
pessoa comprou o carro.

### Colunas novas em tabelas existentes

- `documentos_gerados.cliente_id` uuid → `clientes(id)` **on delete set null**.
  O contrato sobrevive ao cadastro apagado; o nome já está gravado em `cliente`.
- `notas_fiscais.cliente_id` uuid → `clientes(id)` **on delete set null**. Idem.

Nenhuma coluna existente muda de tipo; ambas nascem nulas, e todo o histórico
continua válido.

### Papel derivado do tipo de contrato

| template | quem é o cliente | papel gravado |
|---|---|---|
| `compra-venda` (a Vamaq compra) | `vendedor_*` | `vendeu` |
| `venda` (a Vamaq vende) | `comprador_*` | `comprou` |
| `consignacao` | `proprietario_*` | `consignou` |
| `termo-vistoria` | `proprietario_*` | `consignou` |

É a mesma regra que `src/lib/documentosCliente.js` já usa para decidir de qual campo
sai o nome do cliente — a função nova fica ao lado dela, com a mesma forma.

Na emissão de NF-e com cliente selecionado, o vínculo é `comprou`, origem `nota`.

## Telas

### `/admin/clientes` — lista e busca

Campo único de busca que casa por **nome, CPF/CNPJ ou telefone**, ignorando pontuação
dos dois lados. Lista: nome (com o e-mail embaixo, como a tela de Usuários), documento
formatado, telefone, quantidade de carros. Botão "Novo cliente". Inativos ficam fora
por padrão, com uma caixinha para incluí-los.

### `/admin/clientes/[id]` — a ficha

Três blocos:

1. **Dados** — formulário completo, editável.
2. **Carros** — a resposta para "quais carros são/foram dele": marca, modelo, placa,
   papel, data e de onde veio o vínculo (contrato, nota ou manual), com link para o
   veículo. Um seletor "ligar outro carro" para os negócios antigos, e um botão de
   desfazer em cada linha.
3. **Documentos e notas** — os contratos gerados e as notas emitidas ligados a esse
   cliente, com link para abrir. Vem de graça das colunas `cliente_id` novas.

### Menu

Seção nova `clientes`, prefixo `/admin/clientes`, entre **CRM** e **Financeiro**.
`roles: ["secretaria", "financeiro"]` — mais o admin, que vê tudo.

**O vendedor não vê o menu Clientes, mas precisa escolher um cliente ao gerar
contrato.** Por isso a leitura e a escrita são separadas na API: buscar e ler um
cliente é liberado também para `vendedor`; criar, editar, apagar e mexer nos vínculos
é só `secretaria` e `financeiro`. Assim o seletor funciona dentro de Documentos sem
abrir o cadastro para quem não deve mexer nele.

## Integrações

### Documentos (contratos)

No topo do formulário, um seletor **"Cliente"** com busca. Escolhendo, os campos da
pessoa daquele template são preenchidos — e continuam editáveis, porque o contrato
pode precisar de um dado que o cadastro não tem. Escolher um cliente **não** apaga o
que já foi digitado em campos que o cadastro não preenche.

Ao gerar, além do que já é gravado hoje, vai o `cliente_id`; e se houver veículo
selecionado, o vínculo `cliente_veiculos` é criado com o papel da tabela acima.

Um botão **"Salvar como cliente"** ao lado do seletor, para quem digitou tudo na mão e
quer aproveitar — cria o cadastro a partir dos campos já preenchidos. Só aparece para
quem tem permissão de escrita.

### NF-e

Na tela de emitir, o mesmo seletor preenche `nome`, `doc`, `cep`, `logradouro`,
`numero`, `bairro`, `municipio` e `uf` do destinatário. Os campos seguem editáveis e a
validação atual (11 ou 14 dígitos) continua valendo — o cadastro não é fonte confiável
o bastante para dispensar conferência antes de emitir.

Fora de escopo por decisão: ligar o card do CRM a um cliente cadastrado. O CRM vai ser
redesenhado em seguida; fazer agora é retrabalho garantido.

## Testes

A lógica testável é pura e vai em módulos sem imports (o alias `@/` não resolve em
`node --test`), no mesmo padrão de `cpf.js`, `payload.js` e `buscaVeiculo.js`:

- `src/lib/clientes/doc.js` — `normalizaDoc` (só dígitos), `tipoPorDoc` (11 → pf,
  14 → pj), `formataDoc` (máscara de CPF e de CNPJ), `docValido`.
  Testes: pontuação variada casando com o mesmo documento; documento de tamanho
  inválido; documento vazio; formatação de CPF e de CNPJ.
- `src/lib/clientes/endereco.js` — `enderecoEmUmaLinha`, que monta a linha do contrato
  a partir das partes e **omite as vazias sem deixar vírgula solta**.
  Testes: endereço completo; sem complemento; só município e UF; tudo vazio → string
  vazia.
- `src/lib/clientes/prefill.js` — `camposDoTemplate(templateId, cliente)`, que devolve
  o objeto de campos a preencher, e `papelPorTemplate(templateId)`.
  Testes: um caso por template (`compra-venda`, `venda`, `consignacao`,
  `termo-vistoria`); template desconhecido → objeto vazio e papel nulo; cliente PJ
  levando `representante_*` no template de venda.
- `destinatarioDoCliente(cliente)`, no mesmo módulo: cobre o mapeamento para a NF-e,
  incluindo cliente sem endereço → campos vazios (a validação da emissão é que barra).

O resto — telas, seletor, gravação do vínculo — é verificado por `npm run build`,
pela suíte e por roteiro no navegador contra banco local, incluindo o cenário que já
mordeu uma vez: gerar um contrato com cliente e carro, depois um segundo contrato sem
carro, e conferir que o segundo **não** herdou o vínculo do primeiro.
