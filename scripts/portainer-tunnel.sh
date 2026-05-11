#!/usr/bin/env bash
# Open an SSH tunnel to Portainer running on the Lightsail server.
#
# Usage:
#   export LIGHTSAIL_HOST=203.0.113.10
#   export LIGHTSAIL_PEM="$HOME/path/to/LightsailDefaultKey-us-east-1.pem"
#   export LIGHTSAIL_USER=ubuntu   # optional, default: ubuntu
#   ./scripts/portainer-tunnel.sh
#
# Then open http://localhost:9000 in your browser.
# Press Ctrl+C to close the tunnel.
#
set -euo pipefail

: "${LIGHTSAIL_HOST:?Set LIGHTSAIL_HOST to your instance public IP or hostname}"
LIGHTSAIL_USER="${LIGHTSAIL_USER:-ubuntu}"
LIGHTSAIL_PEM="${LIGHTSAIL_PEM:?Set LIGHTSAIL_PEM to your .pem path}"

if [[ ! -f "$LIGHTSAIL_PEM" ]]; then
  echo "LIGHTSAIL_PEM is not a file: $LIGHTSAIL_PEM" >&2
  exit 1
fi

# Refuse group-/world-readable private keys.
mode=$(stat -c '%a' "$LIGHTSAIL_PEM" 2>/dev/null || stat -f '%OLp' "$LIGHTSAIL_PEM")
m=$((8#$mode))
if (( m & 077 )); then
  echo "ERROR: $LIGHTSAIL_PEM is too permissive (mode $mode). Run: chmod 600 $(printf %q "$LIGHTSAIL_PEM")" >&2
  exit 1
fi

SSH_OPTS=(
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
  SSH_OPTS+=(
    -o "UserKnownHostsFile=${LIGHTSAIL_KNOWN_HOSTS}"
    -o StrictHostKeyChecking=yes
  )
else
  SSH_OPTS+=(-o StrictHostKeyChecking=accept-new)
fi

LOCAL_PORT="${PORTAINER_LOCAL_PORT:-9000}"

echo "==> Opening tunnel: localhost:${LOCAL_PORT} -> ${LIGHTSAIL_HOST}:9000"
echo "    Open http://localhost:${LOCAL_PORT} in your browser."
echo "    Press Ctrl+C to close the tunnel."
echo ""

# Auto-open browser on macOS after a short delay (non-blocking).
if command -v open >/dev/null 2>&1; then
  ( sleep 2 && open "http://localhost:${LOCAL_PORT}" ) &
fi

ssh "${SSH_OPTS[@]}" \
  -L "${LOCAL_PORT}:127.0.0.1:9000" \
  -N \
  "${LIGHTSAIL_USER}@${LIGHTSAIL_HOST}"
