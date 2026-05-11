#!/usr/bin/env bash
#
# Convert docs/demo-videos/*.webm previews → GIF/GIF/*.gif for README embedding on GitHub.
# Requires: ffmpeg (palette workflow keeps GIF sizes manageable.)
#
# Usage (repo root): ./scripts/render-demo-gifs.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/docs/demo-videos"
DST="$ROOT/GIF"

FPS="${DEMO_GIF_FPS:-8}"
WIDTH="${DEMO_GIF_WIDTH:-560}"
MAX_COLORS="${DEMO_GIF_MAX_COLORS:-128}"

mkdir -p "$DST"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "render-demo-gifs: ffmpeg not found. Install ffmpeg (e.g. brew install ffmpeg)." >&2
  exit 1
fi

resolve_src() {
  local base="$1"
  local primary="$SRC/${base}.webm"
  if [[ -f "$primary" ]]; then
    echo "$primary"
    return 0
  fi
  case "$base" in
    03-checkout-flow)
      local spaced="$SRC/03 checkout flow and orders.webm"
      if [[ -f "$spaced" ]]; then
        echo "$spaced"
        return 0
      fi
      ;;
  esac
  return 1
}

render_one() {
  local base="$1"
  local src="$2"
  local out="$DST/${base}.gif"
  echo "render-demo-gifs: $src → $out"
  ffmpeg -hide_banner -loglevel warning -y -i "$src" -vf \
    "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=${MAX_COLORS}[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" \
    "$out"
}

bases=(
  01-storefront-tour
  02-register-session
  03-checkout-flow
  04-search-catalog
  05-sign-in-session
  06-profile-orders
)

any=0
for base in "${bases[@]}"; do
  if src_path="$(resolve_src "$base")"; then
    render_one "$base" "$src_path"
    any=1
  else
    echo "render-demo-gifs: skip $base (no matching .webm under docs/demo-videos)" >&2
  fi
done

if [[ "$any" -eq 0 ]]; then
  echo "render-demo-gifs: no source WebM files found under $SRC" >&2
  exit 1
fi

echo "render-demo-gifs: done → $DST"
