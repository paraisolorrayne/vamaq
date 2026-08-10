#!/usr/bin/env bash
# ============================================================================
# Aplica os schemas do `public` NA ORDEM CERTA.
#
# POR QUE ISTO EXISTE: os sete arquivos têm dependências reais entre si, e
# aplicar fora de ordem falha. Isso não estava escrito em lugar nenhum — em
# 09/08/2026 dois testes que já existiam quebraram por aplicarem
# `crm-schema.sql` sem `clientes-schema.sql` antes. Num banco novo (restauração
# de backup, máquina nova, banco de teste), errar a ordem é questão de tempo.
#
# A ordem e o motivo de cada dependência:
#
#   1. schema.sql          vehicles + a função set_updated_at() que os outros usam
#   2. auth-schema.sql     users, sessions
#   3. funcionarios-schema.sql   ALTERA users (funcionario_id)
#   4. documentos-schema.sql     referencia users e vehicles
#   5. fiscal-schema.sql         ALTERA e referencia vehicles
#   6. clientes-schema.sql       ALTERA documentos_gerados E notas_fiscais
#                                (ou seja: precisa dos DOIS acima)
#   7. crm-schema.sql            referencia clientes, users e vehicles
#
# Todos são idempotentes: rodar de novo não dói e é o jeito normal de aplicar
# uma mudança de schema em produção.
#
# NÃO cobre o financeiro (`db/fin-*.sql`): aquilo vive no schema `fin`, é
# aplicado com OUTRA conexão (`DATABASE_URL_FIN`, role `vamaq_fin`) e a
# blindagem tem script próprio (`scripts/setup-fin-role.sh`). Ver
# docs/ADR-002-plano-desenvolvimento-finance-ai.md e docs/INTEGRACAO-ASAAS.md.
#
# Uso:
#   ./db/aplicar-schemas.sh                      # usa $DATABASE_URL
#   ./db/aplicar-schemas.sh "postgres://..."     # ou a URL como argumento
# ============================================================================
set -euo pipefail

DBURL="${1:-${DATABASE_URL:-}}"
if [ -z "$DBURL" ]; then
  echo "ERRO: passe a URL do banco como argumento ou defina DATABASE_URL." >&2
  exit 1
fi

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"

# A ordem abaixo NÃO é alfabética nem cronológica — é a de dependência.
# Antes de mexer, leia o cabeçalho deste arquivo.
ARQUIVOS=(
  schema.sql
  auth-schema.sql
  funcionarios-schema.sql
  documentos-schema.sql
  fiscal-schema.sql
  clientes-schema.sql
  crm-schema.sql
)

for arquivo in "${ARQUIVOS[@]}"; do
  caminho="$RAIZ/db/$arquivo"
  if [ ! -f "$caminho" ]; then
    echo "ERRO: $caminho não existe." >&2
    exit 1
  fi
  printf '%-28s ' "$arquivo"
  # ON_ERROR_STOP faz o psql sair com erro na primeira falha, em vez de seguir
  # aplicando o resto num banco meio construído.
  # client_min_messages=warning cala os NOTICE de "já existe, pulando", que são
  # o funcionamento NORMAL de um arquivo idempotente e só escondem o que importa.
  # Warning e error continuam aparecendo.
  if PGOPTIONS='--client-min-messages=warning' \
     psql "$DBURL" -v ON_ERROR_STOP=1 -q -f "$caminho" > /dev/null; then
    echo "ok"
  else
    echo "FALHOU"
    echo "Parei em $arquivo. Nada depois dele foi aplicado." >&2
    exit 1
  fi
done

echo
echo "Sete schemas do public aplicados. O financeiro (fin-*.sql) é à parte — ver o cabeçalho deste script."
