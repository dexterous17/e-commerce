#!/usr/bin/env bash
# Sync this repo to a Lightsail Ubuntu instance and run docker compose (lightsail file).
#
# Prerequisites:
#   - DNS A (and AAAA if using IPv6) for ecommerce.harshildex.com and
#     backend.ecommerce.harshildex.com pointing at the instance public IP.
#   - Lightsail firewall: TCP 22, 80, 443 open (restrict SSH source to your IP when possible).
#   - On the server: env/database/.env, env/backend/.env, env/aws/.env (see repo templates).
#
# SSH security (client):
#   - Uses only the given -i key (IdentitiesOnly), publickey only (no password / kbd-interactive).
#   - Default: StrictHostKeyChecking=accept-new (rejects changed host keys after first connect).
#   - Stronger: set LIGHTSAIL_KNOWN_HOSTS to a file of trusted host keys, e.g.
#       mkdir -p deploy/lightsail
#       ssh-keyscan -t ed25519,rsa YOUR_HOST >> deploy/lightsail/known_hosts
#       export LIGHTSAIL_KNOWN_HOSTS="$PWD/deploy/lightsail/known_hosts"
#     (that path is gitignored). Then every connect verifies the key.
#   - Server hardening (password auth off, etc.): run deploy/lightsail/harden-sshd.sh on the VM once.
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

if [[ ! -f "$LIGHTSAIL_PEM" ]]; then
  echo "LIGHTSAIL_PEM is not a file: $LIGHTSAIL_PEM" >&2
  exit 1
fi

# Refuse group-/world-readable private keys (OpenSSH warns; this avoids accidental leaks).
lightsail_key_must_be_private() {
  local f=$1 mode m
  mode=$(stat -c '%a' "$f" 2>/dev/null || stat -f '%OLp' "$f")
  m=$((8#$mode))
  if (( m & 077 )); then
    echo "ERROR: $f is too permissive (mode $mode). Run: chmod 600 $(printf %q "$f")" >&2
    exit 1
  fi
}
lightsail_key_must_be_private "$LIGHTSAIL_PEM"

lightsail_build_ssh_opts() {
  LIGHTSAIL_SSH_OPTS=(
    -i "$LIGHTSAIL_PEM"
    -o IdentitiesOnly=yes
    -o PreferredAuthentications=publickey
    -o PasswordAuthentication=no
    -o KbdInteractiveAuthentication=no
    -o PubkeyAuthentication=yes
  )
  if [[ -n "${LIGHTSAIL_KNOWN_HOSTS:-}" ]]; then
    if [[ ! -f "$LIGHTSAIL_KNOWN_HOSTS" ]]; then
      echo "ERROR: LIGHTSAIL_KNOWN_HOSTS is set but not a file: $LIGHTSAIL_KNOWN_HOSTS" >&2
      exit 1
    fi
    LIGHTSAIL_SSH_OPTS+=(
      -o "UserKnownHostsFile=${LIGHTSAIL_KNOWN_HOSTS}"
      -o StrictHostKeyChecking=yes
    )
  else
    LIGHTSAIL_SSH_OPTS+=(-o StrictHostKeyChecking=accept-new)
  fi
}

lightsail_build_ssh_opts

lightsail_ssh() {
  ssh "${LIGHTSAIL_SSH_OPTS[@]}" "$@"
}

lightsail_scp() {
  scp "${LIGHTSAIL_SSH_OPTS[@]}" "$@"
}

lightsail_rsync_rsh() {
  local parts=(ssh "${LIGHTSAIL_SSH_OPTS[@]}") i s=""
  for i in "${parts[@]}"; do
    s+="$(printf '%q' "$i") "
  done
  printf '%s' "${s% }"
}

# Directory on the server: either a name under the remote home (default: e-commerce) or an absolute path.
REMOTE_DIR="${LIGHTSAIL_REMOTE_DIR:-e-commerce}"
if [[ "$REMOTE_DIR" == /* ]]; then
  REMOTE_CD="cd $(printf %q "$REMOTE_DIR")"
else
  REMOTE_CD="cd \$HOME/$(printf %q "$REMOTE_DIR")"
fi

RSYNC_RSH=$(lightsail_rsync_rsh)
RSYNC=(rsync -avz
  -e "$RSYNC_RSH"
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
lightsail_ssh bash -s <<< "$REMOTE_SCRIPT"

if [[ "${INSTALL_HOST_NGINX:-}" == "1" ]]; then
  echo "==> Installing host nginx site (requires passwordless sudo or you type sudo password)"
  lightsail_scp \
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
  lightsail_ssh bash -s <<< "$NGINX_REMOTE"

  if [[ -n "${CERTBOT_EMAIL:-}" ]]; then
    echo "==> Obtaining TLS certificates with certbot"
    EMAIL_Q=$(printf %q "$CERTBOT_EMAIL")
    lightsail_ssh bash -s <<EOF
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
