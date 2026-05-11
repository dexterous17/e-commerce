#!/usr/bin/env bash
# Re-run NPM bootstrap to create or fix proxy hosts (wrong upstream / wrong site) and,
# when NPM_LETSENCRYPT_EMAIL is configured, attach the shared TLS certificate as well.
# Run on the server from the repo root after ecommerce + NPM are already up.
#
#   ./scripts/npm-repair-proxy-hosts.sh
#
# Uses the same env as docker-compose.nginx-proxy-manager.yml (NPM_ADMIN_PASSWORD, etc.).
# Copy env/npm-bootstrap/.env.example to env/npm-bootstrap/.env if you use a non-default password.
#
# After repair, smoke-test the live site: ./scripts/verify-deployment-endpoints.sh
#
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
docker compose -f docker-compose.lightsail.yml -f docker-compose.nginx-proxy-manager.yml \
  run --rm npm-bootstrap
