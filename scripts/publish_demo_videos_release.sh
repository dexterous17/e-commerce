#!/usr/bin/env bash
#
# Upload assets/*.mp4 to GitHub release "demo-videos" for README inline players.
# Requires: gh CLI, authenticated (gh auth login).
#
# Usage (repo root): ./scripts/publish_demo_videos_release.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS="$ROOT/assets"
TAG="demo-videos"
REPO="${GITHUB_REPOSITORY:-dexterous17/e-commerce}"

if ! command -v gh >/dev/null 2>&1; then
  echo "publish_demo_videos_release: install GitHub CLI (gh) and run gh auth login" >&2
  exit 1
fi

shopt -s nullglob
files=("$ASSETS"/*.mp4)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "publish_demo_videos_release: no assets/*.mp4 found" >&2
  exit 1
fi

if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  echo "publish_demo_videos_release: uploading to release $TAG"
  gh release upload "$TAG" "${files[@]}" --repo "$REPO" --clobber
else
  echo "publish_demo_videos_release: creating release $TAG"
  gh release create "$TAG" "${files[@]}" --repo "$REPO" \
    --title "Demo videos (README inline players)" \
    --notes "MP4s for inline README embeds. Regenerate with npm run publish-demo-videos."
fi

echo "publish_demo_videos_release: done → https://github.com/$REPO/releases/tag/$TAG"
