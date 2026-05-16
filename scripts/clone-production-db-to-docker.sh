#!/usr/bin/env bash
# Clone production PostgreSQL data into the local Docker Compose database.
#
# Prerequisites:
#   - Docker: `docker compose up -d postgres` from repo root (see docker-compose.yml).
#   - Host tools: pg_dump and pg_restore (e.g. macOS: brew install libpq && brew link --force libpq)
#
# Usage:
#   export PRODUCTION_DATABASE_URL='postgresql://user:pass@host:5432/dbname?sslmode=require'
#   ./scripts/clone-production-db-to-docker.sh
#
# Optional:
#   LOCAL_DATABASE_URL — default postgresql://ecommerce:ecommerce@127.0.0.1:5432/ecommerce
#   DUMP_FILE          — path for custom-format dump (default under ./db-backups/)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -z "${PRODUCTION_DATABASE_URL:-}" ]]; then
  echo "Set PRODUCTION_DATABASE_URL to your production postgres URL (read-only user recommended)." >&2
  exit 1
fi

LOCAL_DATABASE_URL="${LOCAL_DATABASE_URL:-postgresql://ecommerce:ecommerce@127.0.0.1:5432/ecommerce}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DUMP_FILE="${DUMP_FILE:-$ROOT/db-backups/prod-${STAMP}.dump}"
mkdir -p "$(dirname "$DUMP_FILE")"

if ! command -v pg_dump >/dev/null 2>&1 || ! command -v pg_restore >/dev/null 2>&1; then
  echo "pg_dump and pg_restore are required on PATH (PostgreSQL client tools)." >&2
  exit 1
fi

echo "==> Dumping production database to $DUMP_FILE"
pg_dump "$PRODUCTION_DATABASE_URL" -Fc --no-owner --no-acl -f "$DUMP_FILE"

echo "==> Restoring into local database (drops/recreates objects where needed)"
# --if-exists avoids errors when objects were never created
set +e
pg_restore -d "$LOCAL_DATABASE_URL" --clean --if-exists --no-owner --no-acl "$DUMP_FILE"
rc=$?
set -e
if [[ "$rc" -ne 0 && "$rc" -ne 1 ]]; then
  echo "pg_restore exited with code $rc (1 can mean non-fatal warnings; check output above)." >&2
  exit "$rc"
fi

echo ""
echo "==> Next: verify structure against the app"
echo "    cd backend && npm run db:validate-schema"
echo ""
echo "Dump kept at: $DUMP_FILE (add db-backups/ to .gitignore; do not commit dumps)"
