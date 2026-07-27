# RENAVE — Registro Nacional de Veículos em Estoque

**Status:** rastreamento no inventário **pronto**; integração automática com o
governo **depende de credenciais da Vamaq** (certificado + credenciamento).

## O que é e por que importa agora

O RENAVE registra digitalmente a **entrada e saída** de veículos do estoque de
lojas/concessionárias. É coordenado pelo **SERPRO** (Ministério da Fazenda). A
**Resolução Contran nº 1.026/2026** (publicada em 30/06/2026) tornou o RENAVE
**obrigatório em todo o Brasil**, com **90 dias** de adaptação — ou seja, prazo
por volta de **fim de setembro/2026**.

**Impacto direto na Vamaq (consignação):** a resolução passou a exigir, para
veículos em **consignação**, **contrato eletrônico registrado no RENAVE com
assinatura digital das partes** — não é mais permitido vender consignado sem
esse registro. Isso conversa direto com os contratos de consignação que o
sistema já gera.

Fluxo: quando a loja **compra/recebe** um veículo, registra a **entrada** (o
carro fica "em estoque" no RENAVE sem transferir a titularidade para a loja);
na **venda**, a saída é feita via **ATPV-e** direto para o comprador (o Detran
tem até ~4 dias para concluir a transferência).

## O que já foi construído (não depende de você)

- Campo **`renave`** em cada veículo (`vehicles.renave` jsonb): situação
  (`nao_iniciado` → `entrada` → `registrado` → `saida`), protocolo/ATPV-e e
  observações. Editável no cadastro do veículo (seção **RENAVE**).
- Veículo que ainda não está **registrado** no RENAVE aparece como
  **pendência** na lista de estoque (junto de placa/documentos). Hoje os 24
  veículos entram como pendência de RENAVE — é o checklist de regularização.

Isso permite **controlar manualmente** a conformidade RENAVE de cada carro já,
antes mesmo da integração automática.

## O que falta para a integração automática (depende da Vamaq)

A automação (registrar entrada/saída pela API sem digitar no portal) exige:

1. **Certificado digital e-CNPJ** (A1 ou A3) da Vamaq.
2. **Credenciamento** da loja junto ao SENATRAN/SERPRO (e habilitação no
   estado — o Detran-MG precisa estar integrado).
3. Definir o caminho de integração: **API do SERPRO** direto **ou** por uma
   **integradora/pátio credenciado** (muitos ERPs de loja usam integradora).
4. Custos por operação variam por estado (há tabela de valores por UF).

**Recomendação:** validar com o **despachante/contador** da Vamaq qual o
caminho no MG (SERPRO direto × integradora) e o custo por registro, antes de
investir no conector. Quando isso estiver definido, o campo `renave` já está
pronto para receber os dados da API (mesmo formato), e dá para automatizar
entrada/saída a partir dos lançamentos de compra/venda.

## Fontes
- [Contran publica Resolução nº 1.026/2026 e torna Renave obrigatório em todo o Brasil — ANAUTOS](https://anautos.org.br/2026/07/02/contran-publica-resolucao-no-1-026-2026-e-torna-renave-obrigatorio-em-todo-o-brasil/)
- [Novo RENAVE Nacional: o que muda para as lojas de veículos — Autocloud](https://www.autocloud.com.br/post/novo-renave-nacional-o-que-muda-para-as-lojas-de-ve%C3%ADculos)
- [O que é Renave — RevendaMais](https://revendamais.com.br/blog/o-que-e-renave-registro-nacional-de-veiculos-em-estoque/)
- [RENAVE 2026: valores por estado — BNDV](https://blog.bndv.com.br/renave-2026-valor-por-estado/)
