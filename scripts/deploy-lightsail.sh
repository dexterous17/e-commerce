#!/usr/bin/env bash
# Sync this repo to a Lightsail Ubuntu instance and run docker compose (lightsail file).
#
# Prerequisites:
#   - DNS A (and AAAA if using IPv6) for ecommerce.harshildex.com and
#     backend.ecommerce.harshildex.com pointing at the instance public IP.
#   - Lightsail firewall: TCP 22, 80, 443 open.
#   - On the server: env/database/.env, env/backend/.env, env/aws/.env (see repo templates).
#
# Usage:
#   export LIGHTSAIL_HOST=203.0.113.10
#   export LIGHTSAIL_PEM="$HOME/path/to/LightsailDefaultKey-us-east-1.pem"
#   export LIGHTSAIL_USER=ubuntu   # optional
#   ./scripts/deploy-lightsail.sh
#
# Optional: install/update host nginx + TLS (needs sudo on server, CERTBOT_EMAIL set):
#   INSTALL_HOST_NGINX=1 CERTBOT_EMAIL=you@example.com ./scripts/deploy-lightsail.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

: "${LIGHTSAIL_HOST:?Set LIGHTSAIL_HOST to your instance public IP or hostname}"
LIGHTSAIL_USER="${LIGHTSAIL_USER:-ubuntu}"
LIGHTSAIL_PEM="${LIGHTSAIL_PEM:?Set LIGHTSAIL_PEM to your .pem path}"
# Directory on the server: either a name under the remote home (default: e-commerce) or an absolute path.
REMOTE_DIR="${LIGHTSAIL_REMOTE_DIR:-e-commerce}"
if [[ "$REMOTE_DIR" == /* ]]; then
  REMOTE_CD="cd $(printf %q "$REMOTE_DIR")"
else
  REMOTE_CD="cd \$HOME/$(printf %q "$REMOTE_DIR")"
fi
SSH=(ssh -i "$LIGHTSAIL_PEM" -o StrictHostKeyChecking=accept-new "${LIGHTSAIL_USER}@${LIGHTSAIL_HOST}")
RSYNC=(rsync -avz
  -e "ssh -i $LIGHTSAIL_PEM -o StrictHostKeyChecking=accept-new"
  --exclude .git
  --exclude backend/node_modules
  --exclude frontend/node_modules
  --exclude frontend/dist
  --exclude frontend/playwright-report
  --exclude frontend/test-results
  --exclude '**/.DS_Store'
  ./ "${LIGHTSAIL_USER}@${LIGHTSAIL_HOST}:${REMOTE_DIR}")

echo "==> Syncing repository to ${LIGHTSAIL_USER}@${LIGHTSAIL_HOST}:${REMOTE_DIR}"
"${RSYNC[@]}"

REMOTE_SCRIPT="set -euo pipefail
${REMOTE_CD}
if ! command -v docker >/dev/null 2>&1; then
  echo \"Docker not found. Install: https://docs.docker.com/engine/install/ubuntu/\"
  exit 1
fi
export FRONTEND_PORT=\"\${FRONTEND_PORT:-8080}\"
export BACKEND_PORT=\"\${BACKEND_PORT:-5004}\"
docker compose -f docker-compose.lightsail.yml build
docker compose -f docker-compose.lightsail.yml up -d
docker compose -f docker-compose.lightsail.yml ps
"

echo "==> Building and starting containers (FRONTEND_PORT=\${FRONTEND_PORT:-8080}, BACKEND_PORT=\${BACKEND_PORT:-5004})"
"${SSH[@]}" bash -s <<< "$REMOTE_SCRIPT"

if [[ "${INSTALL_HOST_NGINX:-}" == "1" ]]; then
  echo "==> Installing host nginx site (requires passwordless sudo or you type sudo password)"
  scp -i "$LIGHTSAIL_PEM" -o StrictHostKeyChecking=accept-new \
    "$ROOT/deploy/lightsail/nginx-ecommerce.conf" \
    "${LIGHTSAIL_USER}@${LIGHTSAIL_HOST}:/tmp/nginx-ecommerce.conf"
  NGINX_REMOTE=$(cat <<'EOS'
set -euo pipefail
sudo apt-get update -qq
sudo apt-get install -y -qq nginx
sudo cp /tmp/nginx-ecommerce.conf /etc/nginx/sites-available/ecommerce
sudo mkdir -p /etc/nginx/sites-enabled
sudo ln -sf /etc/nginx/sites-available/ecommerce /etc/nginx/sites-enabled/ecommerce
if [[ -f /etc/nginx/sites-enabled/default ]]; then
  sudo rm -f /etc/nginx/sites-enabled/default
fi
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx
EOS
)
  "${SSH[@]}" bash -s <<< "$NGINX_REMOTE"

  if [[ -n "${CERTBOT_EMAIL:-}" ]]; then
    echo "==> Obtaining TLS certificates with certbot"
    EMAIL_Q=$(printf "%q" "$CERTBOT_EMAIL")
    "${SSH[@]}" bash -s <<EOF
set -euo pipefail
sudo apt-get install -y -qq certbot python3-certbot-nginx
sudo certbot --nginx \\
  -d ecommerce.harshildex.com -d backend.ecommerce.harshildex.com \\
  --non-interactive --agree-tos -m ${EMAIL_Q} --redirect
EOF
  else
    echo "Skipping certbot (set CERTBOT_EMAIL to enable HTTPS)."
  fi
else
  echo "Host nginx not modified. To install routing + HTTPS, run:"
  echo "  INSTALL_HOST_NGINX=1 CERTBOT_EMAIL=you@example.com $0"
  echo "(after DNS points both hostnames at this instance)"
fi

echo "Done. Frontend (via host nginx): http://ecommerce.harshildex.com"
echo "     API hostname: http://backend.ecommerce.harshildex.com"
