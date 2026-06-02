#!/usr/bin/env bash
#
# Vamaq Motors — deploy no VPS.
#
# Uso (da sua máquina):
#   ssh vamaq-vps deploy.sh
#
# Requer uma cópia executável em /usr/local/bin/deploy.sh no servidor.
# Veja "Setup único no VPS" no fim deste arquivo.
#
# Overrides opcionais (variáveis de ambiente):
#   VAMAQ_APP_DIR   diretório da app (senão: auto-detecta)
#   VAMAQ_BRANCH    branch a deployar (padrão: main)
#   VAMAQ_APP_NAME  nome do processo pm2/systemd (padrão: vamaq)
#
set -euo pipefail

BRANCH="${VAMAQ_BRANCH:-main}"
APP_NAME="${VAMAQ_APP_NAME:-vamaq}"

# --- Descobre o diretório da app -------------------------------------------
APP_DIR="${VAMAQ_APP_DIR:-}"
if [ -z "$APP_DIR" ]; then
  for d in /var/www/vamaq /var/www/vamaq/site /opt/vamaq /root/vamaq /root/site; do
    if [ -f "$d/package.json" ] && [ -d "$d/.git" ]; then APP_DIR="$d"; break; fi
  done
fi
if [ -z "$APP_DIR" ] || [ ! -d "$APP_DIR" ]; then
  echo "✗ Não encontrei o diretório da app." >&2
  echo "  Rode com:  ssh vamaq-vps \"VAMAQ_APP_DIR=/caminho/da/app deploy.sh\"" >&2
  exit 1
fi

echo "▶ App: $APP_DIR  (branch: $BRANCH)"
cd "$APP_DIR"

echo "▶ Atualizando código…"
git fetch --prune origin "$BRANCH"
git reset --hard "origin/$BRANCH"   # produção espelha o remoto, descarta alterações locais

echo "▶ Instalando dependências…"
npm ci

echo "▶ Build…"
npm run build

echo "▶ Reiniciando a aplicação…"
if command -v pm2 >/dev/null 2>&1 && pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
elif [ -f docker-compose.yml ] || [ -f compose.yml ]; then
  docker compose up -d --build
elif systemctl list-unit-files 2>/dev/null | grep -q "^${APP_NAME}\.service"; then
  systemctl restart "$APP_NAME"
else
  echo "⚠ Não detectei pm2/docker/systemd para '$APP_NAME'." >&2
  echo "  Reinicie o processo manualmente ou defina VAMAQ_APP_NAME." >&2
  exit 1
fi

echo "✅ Deploy concluído em $APP_DIR"

# ---------------------------------------------------------------------------
# Setup único no VPS (rode uma vez):
#
#   # depois de já ter feito git pull do projeto no servidor:
#   sudo cp /var/www/vamaq/scripts/deploy.sh /usr/local/bin/deploy.sh
#   sudo chmod +x /usr/local/bin/deploy.sh
#
# A cópia em /usr/local/bin é o que roda — assim o "git reset" do deploy
# não reescreve o script no meio da execução (evita corromper o run).
# Sempre que mudar este script, repita o cp acima.
# ---------------------------------------------------------------------------
