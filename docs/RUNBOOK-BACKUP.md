# Runbook — Backup e restauração do site Vamaq

**PR-A do [ADR-002](./ADR-002-plano-desenvolvimento-finance-ai.md).** Pré-requisito bloqueante de
qualquer migration em produção.

## O que é copiado

| Item | Onde vive | Backup |
|---|---|---|
| Banco Postgres (db `vamaq`) | Postgres local na VPS (`127.0.0.1:5432`) | `db-<data>.dump` — formato custom (`pg_restore`) |
| Fotos de veículos | `/var/www/vamaq/public/images/vehicles` (runtime, **fora do git**) | `fotos-<data>.tar.gz` |

Destino: **`/var/backups/vamaq/`** na própria VPS. Retenção: 14 dias (rotação automática).

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
