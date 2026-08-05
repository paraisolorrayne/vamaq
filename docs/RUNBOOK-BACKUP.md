# Runbook — Backup e restauração do site Vamaq

**PR-A do [ADR-002](./ADR-002-plano-desenvolvimento-finance-ai.md).** Pré-requisito bloqueante de
qualquer migration em produção.

## O que é copiado

| Item | Onde vive | Backup |
|---|---|---|
| Banco Postgres (db `vamaq`) | Postgres local na VPS (`127.0.0.1:5432`) | `db-<data>.dump` — formato custom (`pg_restore`) |
| Fotos de veículos | `/var/www/vamaq/public/images/vehicles` (runtime, **fora do git**) | `fotos-<data>.tar.gz` |
| Dados privados | `/var/www/vamaq/data` — documentos digitalizados do veículo, **contratos gerados** e rascunhos | `data-<data>.tar.gz` |

Destino: **`/var/backups/vamaq/`** na própria VPS. Retenção: 14 dias (rotação automática).

> ⚠️ **Banco e `data/` restauram JUNTOS.** A tabela `documentos_gerados` guarda o caminho do PDF;
> o PDF mora em `data/documentos/`. Restaurar só o dump produz linhas apontando para arquivos que
> não existem — a tela responde "documento indisponível" em vez de quebrar, mas o contrato está
> perdido. Restaurar só o `data/` deixa PDFs órfãos, invisíveis pelo painel.

> 🔥 **Incidente 28/07 → 05/08/2026 — nove dias sem backup, sem alarme.** O `pg_dump` rodava com a
> role do app, que **não enxerga o schema `fin`** (blindagem do financeiro, criada em 27/07). Ele
> falhava, o `set -e` abortava o script, e o resultado era um `db-<data>.dump` de **0 bytes** — mais
> as fotos nunca copiadas, porque o tar vinha depois. O arquivo aparecia todo dia, então nada
> parecia errado. Corrigido em 05/08/2026: o dump passou a rodar como **superusuário do Postgres**.
> **Lição para a próxima:** backup que não é conferido não é backup. Ver "Conferir se está saudável".

> ⚠️ **Limitação conhecida (decisão de 2026-07-24):** o backup fica na mesma VPS. Protege contra
> exclusão acidental, migration ruim e corrupção de dados — **não** contra perda do disco/servidor.
> Para cobrir isso, somar um envio externo apontando para `/var/backups/vamaq` (Backblaze B2,
> Wasabi, ou `rsync` para outro host). O script já concentra tudo nessa pasta justamente para essa
> extensão ser trivial depois.

## Script

Fonte versionada: [`scripts/backup-vamaq.sh`](../scripts/backup-vamaq.sh). Na VPS, instalado em
`/usr/local/bin/backup-vamaq.sh` (cópia idêntica — manter em sincronia ao editar).

## Instalação (feita em 2026-07-24)

```bash
# copiar o script para a VPS e dar permissão
install -m 755 backup-vamaq.sh /usr/local/bin/backup-vamaq.sh

# agendar: todo dia às 03:15
( crontab -l 2>/dev/null; echo "15 3 * * * /usr/local/bin/backup-vamaq.sh >> /var/log/vamaq-backup.log 2>&1" ) | crontab -
```

## Rodar manualmente

```bash
sudo /usr/local/bin/backup-vamaq.sh
tail -n 5 /var/log/vamaq-backup.log
ls -lh /var/backups/vamaq
```

## Restauração (ensaiada em 2026-07-24)

### Banco — para um db de teste (não toca produção)

```bash
sudo -u postgres createdb vamaq_restore_test
sudo -u postgres pg_restore --no-owner -d vamaq_restore_test /var/backups/vamaq/db-<data>.dump
sudo -u postgres psql -d vamaq_restore_test -c "select count(*) from vehicles;"   # confere contagem
sudo -u postgres dropdb vamaq_restore_test                                         # limpa
```

### Banco — restauração real (produção, em desastre)

```bash
pm2 stop vamaq
sudo -u postgres dropdb vamaq && sudo -u postgres createdb vamaq -O vamaq
sudo -u postgres pg_restore --no-owner --role=vamaq -d vamaq /var/backups/vamaq/db-<data>.dump
pm2 start vamaq
```

### Fotos

```bash
tar -xzf /var/backups/vamaq/fotos-<data>.tar.gz -C /var/www/vamaq/public/images
```

### Dados privados (`data/`)

```bash
tar -xzf /var/backups/vamaq/data-<data>.tar.gz -C /var/www/vamaq
```

Restaura `data/documentos` (contratos gerados), `data/vehicle-docs` (digitalizados) e
`data/prefill` (rascunhos). Faça **junto** com a restauração do banco — ver aviso no topo.

## Conferir se está saudável

O incidente de 28/07–05/08/2026 passou nove dias despercebido porque ninguém olhou o tamanho dos
arquivos. Uma vez por mês, ou depois de qualquer mudança de schema/permissão no banco:

```bash
ssh -i ~/.ssh/vamaq_vps root@185.197.194.18 \
  'ls -lh /var/backups/vamaq/ | tail -6; tail -3 /var/log/vamaq-backup.log'
```

O que esperar:

- **`db-<data>.dump` com dezenas de KB** — `0` significa backup quebrado, não banco vazio;
- **`fotos-<data>.tar.gz` na casa das centenas de MB**;
- **`data-<data>.tar.gz` presente** (cresce conforme os contratos são gerados);
- a última linha do log começando com `ok:` e citando os **três** artefatos.

Para provar que o dump presta, e não só que existe:

```bash
ssh -i ~/.ssh/vamaq_vps root@185.197.194.18 \
  'sudo -u postgres pg_restore -l $(ls -t /var/backups/vamaq/db-*.dump | head -1) | grep -c "TABLE DATA"'
```

Deve responder um número próximo do total de tabelas com dados (18 em 05/08/2026). `0` ou erro =
dump inútil.
