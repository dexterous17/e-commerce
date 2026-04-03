#!/usr/bin/env bash
# Run on the Ubuntu server (once) after you have confirmed key-based SSH works.
# Disables password and keyboard-interactive login; keeps pubkey auth only.
#
#   ssh -i your.pem ubuntu@YOUR_IP 'bash -s' < deploy/lightsail/harden-sshd.sh
#
# Or copy this file to the server and: sudo bash harden-sshd.sh
#
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Re-run with sudo: sudo bash $0" >&2
  exit 1
fi

backup="/etc/ssh/sshd_config.bak.$(date +%Y%m%d%H%M%S)"
cp -a /etc/ssh/sshd_config "$backup"
echo "Backed up sshd_config to $backup"

dropin="/etc/ssh/sshd_config.d/99-ecommerce-hardening.conf"
cat >"$dropin" <<'EOF'
# Managed by e-commerce repo deploy/lightsail/harden-sshd.sh — pubkey only, no passwords.
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
PermitRootLogin no
X11Forwarding no
MaxAuthTries 4
LoginGraceTime 30
EOF

echo "Wrote $dropin"

if ! /usr/sbin/sshd -t; then
  echo "sshd -t failed; removing drop-in" >&2
  rm -f "$dropin"
  exit 1
fi

systemctl reload ssh 2>/dev/null || systemctl reload sshd
echo "sshd reloaded. Keep this session open; open a second terminal and test SSH before closing."
