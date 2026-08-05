# Emissão de NF-e (modelo 55) pelo painel, via Focus NFe

**Data:** 2026-08-04 · **Status:** aprovado, pronto para plano de implementação

## Problema

A Vamaq não tem por onde emitir nota fiscal. Hoje a venda de seminovo é
transferida por CRV/ATPV-e e a nota de entrada de consignação é emitida pelo
contador, por fora. Quando o RENAVE passar a valer (Resolução Contran
1.026/2026, prazo por volta de 30/09/2026), pode passar a existir nota no fluxo
da loja — e a exigência do negócio é clara: **o operador emite de dentro do
painel**, sem abrir outro sistema.

O sistema não fala com a SEFAZ. Ele chama por API um emissor fiscal, que assina
com o certificado, transmite e devolve XML e DANFE.

## Decisões tomadas

| Questão | Decisão |
|---|---|
| Qual documento | **NF-e modelo 55** (venda). Não a nota de entrada de consignação, não NFS-e. |
| Provedora | **Focus NFe**. Plano Solo R$ 89,90/mês, 100 notas, 1 CNPJ, R$ 0,10 por nota extra, 30 dias de teste. |
| Disparo | **Tela de conferência**: o sistema pré-preenche, o operador confere e clica Emitir. |
| Pós-emissão | Emitir, guardar XML/DANFE e **cancelar** pelo painel. Carta de correção e inutilização ficam de fora. |
| Ambiente inicial | **Homologação**. Produção só depois de validado com os parâmetros do contador. |

Descartado: emissor próprio falando direto com a SEFAZ (assinatura de XML,
contingência, eventos e o layout novo de CBS/IBS viram manutenção permanente
para economizar R$ 90/mês). Descartada também a Nuvem Fiscal — **desativada em
31/07/2026**.

Fora de escopo: NFS-e de serviço, nota de entrada de consignação, carta de
correção, inutilização de numeração, webhook do Focus (o polling resolve o
MVP), e a integração RENAVE.

## Contexto que muda o desenho

Duas lacunas de dado, descobertas no schema atual:

- **`vehicles` não tem chassi** (só `placa`). A nota precisa do chassi.
- **O CRM não guarda endereço do comprador** (`oportunidades` tem nome,
  telefone e e-mail). A NF-e exige destinatário completo com CEP, logradouro,
  número, bairro, município e UF.

Por isso a tela de conferência não é enfeite: é onde o que falta é preenchido.

## Integração — `src/lib/fiscal/focus/`

`client.js`, cliente REST puro, no padrão de `src/lib/fin/asaas/client.js`:

- `focusEnabled()` — false sem `FOCUS_NFE_TOKEN`; nada é chamado.
- `emitirNfe(ref, payload)` — `POST /nfe`, com a `ref` como identificador da
  emissão.
- `consultarNfe(ref)` — `GET /nfe/{ref}`; devolve status e os caminhos do XML e
  do DANFE.
- `cancelarNfe(ref, justificativa)` — `POST /nfe/{ref}/cancel`, síncrono.

Variáveis de ambiente: `FOCUS_NFE_TOKEN` e `FOCUS_NFE_ENV`
(`homologacao` | `producao`, default `homologacao`).

**As URLs base de cada ambiente e o formato exato do cabeçalho de autenticação
são lidos da documentação da Focus na hora de implementar**
(`doc.focusnfe.com.br/reference/ambiente` e `/reference/autenticacao`) — não
chutar nem copiar de memória. Os endpoints, os status e a exigência de
justificativa no cancelamento foram confirmados na documentação em 04/08/2026.

A emissão é **assíncrona por padrão**: a resposta do POST não é a autorização.
Status relevantes: `processando_autorizacao`, `autorizado`, `erro_autorizacao`.
A `ref` é imutável — uma nota rejeitada é corrigida e reemitida com **ref nova**.

## Schema — `db/fiscal-schema.sql`

Schema `public`, role do app, arquivo idempotente, padrão de `db/crm-schema.sql`.

```sql
notas_fiscais
  id, ref (text unique — nosso identificador da emissão),
  vehicle_id → vehicles(id) on delete restrict,
  status text ('processando'|'autorizada'|'erro'|'cancelada'),
  numero, serie, chave,
  valor numeric(12,2),
  destinatario jsonb,          -- nome, doc, e endereço completo
  mensagem text,               -- retorno da SEFAZ quando rejeita
  xml_url, danfe_url,
  justificativa_cancelamento, cancelada_em,
  raw jsonb, created_at, updated_at

fiscal_config                  -- linha única; os valores vêm do contador
  id, cnpj, ie, im, regime_tributario,
  cfop, cst, ncm, serie,
  icms_seminovo_aliquota numeric(5,2)
```

**A numeração das notas fica com a Focus**, configurada na conta — o sistema não
guarda `proximo_numero` nem incrementa contador. Duas fontes de numeração é
como se emite nota com número duplicado.

E a coluna que falta no estoque:

```sql
alter table vehicles add column if not exists chassi text;
```

`on delete restrict` no `vehicle_id`: veículo com nota emitida não some do
sistema. `fiscal_config` sem tela por enquanto — seed por SQL, documentado; são
valores que mudam quase nunca e vêm do contador.

## Telas

**Botão "Emitir nota fiscal"** no dossiê do veículo, visível só quando
`status = 'vendido'`, levando a `/admin/fiscal/emitir/[vehicleId]`:

1. Pré-preenchido: veículo (marca, modelo, ano, placa, chassi), valor da venda,
   emitente (de `fiscal_config`).
2. Preenchido na hora: **destinatário completo** — nome, CPF/CNPJ, CEP,
   logradouro, número, bairro, município, UF.
3. Mostrado antes de enviar: os impostos calculados, com a base do ICMS do
   seminovo (venda − compra) e a alíquota.
4. Botão **Emitir**.

**De onde vêm os dois valores do cálculo:** o **valor da venda** começa em
`vehicles.price` e é **editável na tela** — preço de anúncio e preço fechado
raramente são o mesmo número. O **custo de aquisição** vem da view
`fin.v_vehicle_margin`, lida pela camada financeira que já existe
(`src/lib/fin/`, conexão `DATABASE_URL_FIN`); quando o veículo não tem compra
lançada no financeiro, a tela diz isso e pede o valor ao operador em vez de
assumir zero — base zerada significaria ICMS zerado numa nota real. A tela
sempre mostra a origem de cada número.

**`/admin/fiscal`** — lista das notas: veículo, número, status, valor, data,
links do DANFE e do XML, e botão **Cancelar** (pede justificativa; a janela é de
24h após a autorização).

Acesso: `admin` e `financeiro`, via `requireRole` e nova seção em
`src/lib/auth/permissions.js`.

## Estados e erros

- POST aceito → grava `processando` e a tela consulta o status até resolver.
- `erro_autorizacao` → status `erro`, com **a mensagem da SEFAZ exibida na
  tela**; o operador corrige e reemite (ref nova).
- Cancelamento fora da janela de 24h → a Focus recusa; a mensagem dela aparece
  na tela, sem inventar comportamento local.
- Sem `FOCUS_NFE_TOKEN`, a tela mostra "integração não ativada" e nenhum botão
  de emissão aparece — mesmo comportamento da tela de Cobranças do Asaas.

## Dependências externas

Nada disso é código, e sem os três a nota não vai para produção:

1. **Certificado A1** (`.pfx` + senha) enviado à Focus. Se o certificado da
   Vamaq for A3 (token/cartão), não serve em servidor — precisa emitir um A1.
2. **Conta na Focus** e o token de API.
3. **Do contador (Rodrigo)**: CFOP, CST/origem, NCM, série e numeração inicial,
   e como o ICMS do seminovo (base = lucro, 5%) é declarado no XML.

Com 1 e 2, valida-se tudo em homologação com valores de teste. O item 3 é o que
libera produção.

## Testes

- `tests/fiscal-payload.test.mjs` — montagem do payload da NF-e: campos
  obrigatórios presentes, destinatário completo, e o cálculo da base do ICMS do
  seminovo (venda − compra, nunca negativo). Puro, sem rede, importado por
  caminho relativo (o alias `@/` não resolve em `node --test`).
- `tests/fiscal-schema.test.mjs` — contrato do schema contra Postgres real:
  `ref` única, `on delete restrict` no veículo, e o CHECK de `status`.
- Integração real: só em homologação, roteiro manual escrito no plano. Não há
  harness de teste de componente React neste projeto.

## Deploy

```
psql "$DATABASE_URL" -f db/fiscal-schema.sql   # antes do build
npm install && npm run build && pm2 restart vamaq
```

Mais `FOCUS_NFE_TOKEN` e `FOCUS_NFE_ENV=homologacao` no `.env.local` da VPS.
Atenção ao gotcha já conhecido do `.env.local` deste projeto: valor que começa
com `$` precisa ser escapado (`\$`), senão o dotenv-expand do Next apaga.
