#!/usr/bin/env bash
# Start only the PostgreSQL service from docker-compose.yml (same image/volume as full stack).
#
#   ./scripts/start-postgres-docker.sh
#
# Default connection from the host (backend/db/.env):
#   DATABASE_URL=postgresql://ecommerce:ecommerce@127.0.0.1:5432/ecommerce
#
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
docker compose up -d postgres
docker compose ps postgres
echo ""
echo "Postgres is up. Schema is applied when the backend starts, or run:"
echo "  cd backend && npm run db:validate-schema"
