# Persistir os documentos gerados

**Data:** 2026-08-05 · **Status:** aprovado, pronto para plano de implementação

## Problema

Os contratos da Vamaq — compra e venda, venda, consignação e termo de vistoria
— são montados no navegador e baixados na máquina de quem gerou. **Nada fica no
servidor.** Se a Louanny gerou um contrato em março e o cliente aparece em
outubro pedindo cópia, a única esperança é o arquivo ainda estar no computador
dela.

Contrato é prova. Precisa ficar guardado, e precisa ser encontrável depois.

## Decisões tomadas

| Questão | Decisão |
|---|---|
| Onde consultar | **Nos dois lugares**: lista própria com busca, e no dossiê do veículo quando houver carro ligado. |
| Quando salvar | **Ao gerar o PDF**, automático. A pré-visualização não grava nada. |
| Como guardar | Arquivo em disco + tabela no banco. **O PDF que saiu, byte a byte** — não os dados para regerar. |
| Quem acessa | Mesma regra da tela de Documentos: `admin`, `vendedor`, `secretaria`. |
| Backup | Incluído nesta entrega (ver seção própria). |

Descartado: guardar só os dados e regerar o PDF na consulta. Ocuparia quase nada
e acompanharia mudanças de modelo — que é exatamente o problema: o documento
aberto daqui a um ano sairia **diferente do que foi assinado**.

## Onde o arquivo mora

`data/documentos/<ano>/<uuid>.pdf` — fora do `public/`, servido só com login,
mesmo padrão de `data/vehicle-docs/`, que já roda em produção.

## Tabela — `db/documentos-schema.sql`

```sql
documentos_gerados
  id          uuid primary key
  tipo        text not null      -- compra-venda | venda | consignacao | termo-vistoria
  titulo      text not null      -- o título que sai no PDF
  cliente     text               -- nome da outra parte; null quando não identificado
  vehicle_id  uuid references vehicles(id) on delete set null
  arquivo     text not null      -- caminho relativo dentro de data/documentos
  tamanho     integer
  criado_por  uuid references users(id) on delete set null
  created_at  timestamptz not null default now()
```

`on delete set null` no veículo e em `criado_por`: **apagar um carro ou um
usuário não pode apagar o contrato**. Ele vale por si.

Índices: `created_at desc` (a lista é cronológica), `vehicle_id` (o bloco do
dossiê) e `lower(cliente)` (a busca).

## Como o arquivo chega ao servidor

O PDF continua sendo montado no navegador por `generateContractPdf(preview)`
(`src/lib/contractPdf.js`), chamado por `handleDownloadPdf` na tela de
Documentos. Passa a acontecer o seguinte, nesta ordem:

1. O PDF é montado e **baixado**, como hoje.
2. O mesmo blob é enviado a `POST /api/admin/documentos-gerados`, com tipo,
   título, cliente e o `vehicle_id` selecionado na tela, se houver.

**Regra firme: o download vem primeiro e nunca depende do arquivamento.** Se o
envio falhar, o operador já tem o arquivo, e a tela avisa que a cópia não foi
guardada. Gerar o contrato do cliente que está na sua frente não pode quebrar
por causa do histórico.

### De onde sai o nome do cliente

Cada modelo chama a outra parte de um jeito (comprador, vendedor, consignante,
proprietário). Uma função pura em `src/lib/contractTemplates.js` —
`clienteDoDocumento(templateId, values)` — devolve esse nome a partir dos campos
que o próprio modelo declara, ou `null` quando não houver. Sendo pura, é
testável sem banco e sem rede.

## Onde consultar

**`/admin/documentos/gerados`** — lista cronológica com data, tipo, cliente,
veículo e quem gerou; busca por cliente ou placa; botão para abrir o PDF.
Atalho a partir da tela de Documentos.

**No dossiê do veículo** — um bloco somente-leitura com os contratos daquele
carro, marcados como *gerado pelo sistema*, para não se confundir com os
documentos digitalizados que já ficam ali.

## Acesso

Páginas e rotas exigem `admin`, `vendedor` ou `secretaria` — exatamente quem já
pode gerar contrato. Quem gera, consulta.

## Backup — corrige uma lacuna que já existe

O backup diário (`/usr/local/bin/backup-vamaq.sh`, cron 03:15) hoje copia o
banco (`pg_dump`) e as fotos (`public/images/vehicles`). **A pasta `data/` fica
de fora** — e ela já guarda os documentos digitalizados dos veículos (CRLV, CRV,
nota de compra). Isso é risco existente, não criado por esta entrega, mas
persistir contrato ali sem cópia seria meia solução.

Entra nesta entrega: acrescentar um `tar` de `data/` ao script, com a mesma
retenção dos demais, e atualizar `docs/RUNBOOK-BACKUP.md` com o passo de
restauração dessa pasta.

## Erros

- Falha ao gravar (disco cheio, permissão): a rota devolve erro, a tela avisa
  que a cópia não foi guardada — **o download já aconteceu**.
- Documento sem veículo: aparece só na lista; o bloco do dossiê não existe para
  ele.
- Cliente não identificado: a lista mostra "—" e a busca ainda acha por tipo e
  data.
- Arquivo apagado do disco com a linha no banco: ao abrir, a rota responde que o
  arquivo não está mais disponível, em vez de estourar.

## Testes

- `clienteDoDocumento` — pura, testável direto: os quatro modelos, campo vazio,
  modelo desconhecido.
- Contrato do schema contra Postgres real: apagar o veículo **mantém** o
  documento com `vehicle_id` nulo; apagar o usuário mantém com `criado_por`
  nulo; documento sem veículo é aceito.
- Sem harness de componente React no projeto: as telas são verificadas por
  build mais roteiro no navegador — gerar um contrato, vê-lo aparecer na lista e
  no dossiê, e reabrir o PDF.

## Deploy

```
psql "$DATABASE_URL" -f db/documentos-schema.sql   # antes do build
npm install && npm run build && pm2 restart vamaq
```

Mais a atualização do script de backup na VPS. A pasta `data/documentos/` é
criada sozinha na primeira gravação.
