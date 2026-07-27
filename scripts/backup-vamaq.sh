#!/usr/bin/env bash
# ============================================================================
# Backup do site Vamaq (roda NA VPS).
#
# Gera, uma vez por dia, dois arquivos em /var/backups/vamaq:
#   - db-<data>.dump      → Postgres em formato custom (pg_restore), comprimido
#   - fotos-<data>.tar.gz → public/images/vehicles (fotos de runtime, fora do git)
#
# Mantém os últimos RETAIN dias (rotação automática).
#
# ATENÇÃO: guarda na PRÓPRIA VPS. Protege contra apagar sem querer, migration
# ruim ou corrupção de dados — NÃO contra perda do disco/servidor. Para
# sobreviver a isso, somar um envio externo (Backblaze B2 / rsync p/ outro host)
# apontando para $DEST. Ver docs/RUNBOOK-BACKUP.md.
#
# Instalação: ver RUNBOOK. Uso manual: sudo /usr/local/bin/backup-vamaq.sh
# ============================================================================
set -euo pipefail

APP_DIR=/var/www/vamaq
DEST=/var/backups/vamaq
RETAIN=14
STAMP=$(date +%Y-%m-%d_%H%M)
LOG=/var/log/vamaq-backup.log

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

mkdir -p "$DEST"

# DATABASE_URL vem do .env.local do app (não fica hardcoded aqui).
DBURL=$(grep -E '^DATABASE_URL=' "$APP_DIR/.env.local" | cut -d= -f2- | tr -d '"'"'")
if [ -z "${DBURL:-}" ]; then
  log "ERRO: DATABASE_URL não encontrado em $APP_DIR/.env.local"
  exit 1
fi

# 1) Banco — formato custom (-Fc): restaurável com pg_restore, já comprimido.
pg_dump "$DBURL" -Fc -f "$DEST/db-$STAMP.dump"

# 2) Fotos de veículos (gravadas em runtime, não versionadas).
if [ -d "$APP_DIR/public/images/vehicles" ]; then
  tar -czf "$DEST/fotos-$STAMP.tar.gz" -C "$APP_DIR/public/images" vehicles
else
  log "AVISO: pasta de fotos não encontrada — pulei o tar."
fi

# 3) Dados privados (data/): documentos de veículos (CRLV, CRV, NF) e rascunhos
#    de contrato — dados sensíveis, fora do git, existem só no disco.
if [ -d "$APP_DIR/data" ]; then
  tar -czf "$DEST/data-$STAMP.tar.gz" -C "$APP_DIR" data
fi

# 4) Rotação: apaga backups com mais de RETAIN dias.
find "$DEST" -maxdepth 1 -name 'db-*.dump' -mtime +"$RETAIN" -delete
find "$DEST" -maxdepth 1 -name 'fotos-*.tar.gz' -mtime +"$RETAIN" -delete
find "$DEST" -maxdepth 1 -name 'data-*.tar.gz' -mtime +"$RETAIN" -delete

DBSZ=$(du -h "$DEST/db-$STAMP.dump" 2>/dev/null | cut -f1)
FOTOSZ=$(du -h "$DEST/fotos-$STAMP.tar.gz" 2>/dev/null | cut -f1 || echo "-")
DATASZ=$(du -h "$DEST/data-$STAMP.tar.gz" 2>/dev/null | cut -f1 || echo "-")
log "ok: db-$STAMP.dump ($DBSZ) + fotos-$STAMP.tar.gz ($FOTOSZ) + data-$STAMP.tar.gz ($DATASZ)"
