#!/usr/bin/env bash
# Load catalog into PostgreSQL using backend/data/products-s3-manifest.json (images already in S3).
# Run ON THE LIGHTSAIL HOST from this repo root, after: docker compose -f docker-compose.lightsail.yml up -d
#
#   ./scripts/lightsail-seed-from-manifest.sh
#
# Requires env/backend/.env (JWT, etc.) and env/aws/.env if the seeder verifies S3 objects.
#
# WARNING: This seeder deletes existing users, products, orders, and seed_manifest, then re-inserts
# users from backend/data/users.js plus products from the manifest. Do not run on a DB you care to keep
# unless you accept that wipe.
#
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Seeding via backend container (see backend/seederS3FromManifest.js)..."
docker compose -f docker-compose.lightsail.yml exec backend npm run data:import:s3:manifest

echo ""
echo "Done. Smoke-test (use http or https to match your site):"
echo "  ./scripts/verify-deployment-endpoints.sh http://ecommerce.harshildex.com"
