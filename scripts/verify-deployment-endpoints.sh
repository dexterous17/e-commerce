#!/usr/bin/env bash
# Smoke-test a deployed storefront: API health, JSON products, first proxied image response.
# Run from your laptop or on the server after deploy / NPM repair.
#
#   ./scripts/verify-deployment-endpoints.sh
#   ./scripts/verify-deployment-endpoints.sh https://ecommerce.harshildex.com
#
set -euo pipefail

BASE="${1:-https://ecommerce.harshildex.com}"
BASE="${BASE%/}"

die() {
  echo "verify-deployment-endpoints: $*" >&2
  exit 1
}

command -v curl >/dev/null || die "curl is required"

echo "== GET $BASE/api/health =="
curl -fsS --connect-timeout 15 --max-time 60 "$BASE/api/health" \
  | { command -v jq >/dev/null && jq . || cat; } || die "health check failed (API or proxy down?)"

echo ""
echo "== GET $BASE/api/products/featured =="
FEAT=$(curl -fsS --connect-timeout 15 --max-time 60 "$BASE/api/products/featured") \
  || die "featured products request failed"

echo "$FEAT" | { command -v jq >/dev/null && jq . || cat; }

IMG=$(FEAT_JSON="$FEAT" python3 -c "
import json, os
raw = os.environ.get('FEAT_JSON', '[]')
data = json.loads(raw)
products = data if isinstance(data, list) else data.get('products') or []
for p in products:
    imgs = p.get('images') or []
    if imgs and isinstance(imgs[0], str) and imgs[0].strip():
        print(imgs[0].strip())
        break
" || true)

if [[ -z "${IMG:-}" ]]; then
  die "no image URL in featured products — check DB seeds and AWS_S3_* / image proxy"
fi

if [[ "$IMG" != http://* && "$IMG" != https://* ]]; then
  IMG="$BASE$IMG"
fi

echo ""
echo "== HEAD product image =="
echo "$IMG"
code=$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 15 --max-time 60 -I "$IMG" || echo "000")
if [[ "$code" != "200" && "$code" != "304" ]]; then
  die "image HEAD returned HTTP $code (expect 200/304). Check S3 credentials, NPM /api/media routing, and bucket keys."
fi
echo "HTTP $code OK"

echo ""
echo "All checks passed."
