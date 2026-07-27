#!/usr/bin/env bash
# ============================================================================
# Cria a role de leitura do financeiro (vamaq_fin) e aplica a blindagem do
# estoque (PR-C do ADR-002). Roda NA VPS, como superusuário do Postgres:
#
#   sudo -u postgres bash scripts/setup-fin-role.sh vamaq
#
# - Gera uma senha forte (ou usa a existente se a role já existir e você passar
#   --keep), cria/atualiza a role vamaq_fin, aplica db/fin-blindagem.sql e
#   imprime a linha DATABASE_URL_FIN para você colar no .env.local do app.
# - Idempotente: rodar de novo só re-aplica grants (com --keep, mantém a senha).
# ============================================================================
set -euo pipefail

DB="${1:-vamaq}"
KEEP=""
[ "${2:-}" = "--keep" ] && KEEP=1

ROLE=vamaq_fin
HERE="$(cd "$(dirname "$0")/.." && pwd)"

exists=$(psql -d "$DB" -tAc "select 1 from pg_roles where rolname='$ROLE'")

if [ "$exists" = "1" ] && [ -n "$KEEP" ]; then
  echo "role $ROLE já existe — mantendo a senha (--keep)."
  PW=""
else
  PW=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)
  if [ "$exists" = "1" ]; then
    psql -d "$DB" -c "alter role $ROLE login password '$PW';" >/dev/null
    echo "role $ROLE já existia — senha redefinida."
  else
    psql -d "$DB" -c "create role $ROLE login password '$PW';" >/dev/null
    echo "role $ROLE criada."
  fi
fi

# aplica schema fin + view + grants + revokes
psql -d "$DB" -f "$HERE/db/fin-blindagem.sql" >/dev/null
echo "blindagem aplicada (schema fin, view v_vehicles, grants/revokes)."

if [ -n "$PW" ]; then
  echo ""
  echo "Adicione ao /var/www/vamaq/.env.local (a conexão só-leitura do financeiro):"
  echo "DATABASE_URL_FIN=postgres://$ROLE:$PW@127.0.0.1:5432/$DB"
fi
