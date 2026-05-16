#!/usr/bin/env bash
# Mirror objects from local MinIO (Docker) into an existing AWS S3 bucket (MinIO Client `mc`).
#
# The AWS bucket must already exist (you create it in AWS and put its name/region/keys in env/aws/.env).
# This script only syncs object keys under AWS_S3_PREFIX; it does not create the AWS bucket.
#
# Prereqs: MinIO up (`docker compose up -d minio`), `env/aws/.env` with
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET_NAME, AWS_S3_PREFIX
# Use the same bucket name + prefix on MinIO (see docker-compose `minio-init`) and on AWS so paths match this app.
#
# Usage (repo root):
#   ./scripts/sync-minio-to-s3.sh
#   ./scripts/sync-minio-to-s3.sh --dry-run
#   MINIO_URL=http://127.0.0.1:9010 ./scripts/sync-minio-to-s3.sh
#
# Linux (Docker without host.docker.internal): try
#   MC_HOST_EXTRA="--add-host=host.docker.internal:host-gateway" ./scripts/sync-minio-to-s3.sh
#
# With mc installed on the host:
#   MC_USE_LOCAL_MC=1 ./scripts/sync-minio-to-s3.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DRY_FLAG=""
for a in "$@"; do
  if [[ "$a" == "--dry-run" ]]; then
    DRY_FLAG="--dry-run"
  fi
done

if [[ -f "$ROOT/env/aws/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT/env/aws/.env"
  set +a
fi

: "${AWS_ACCESS_KEY_ID:?Set AWS_ACCESS_KEY_ID (e.g. in env/aws/.env)}"
: "${AWS_SECRET_ACCESS_KEY:?Set AWS_SECRET_ACCESS_KEY (e.g. in env/aws/.env)}"
: "${AWS_REGION:?Set AWS_REGION}"
: "${AWS_S3_BUCKET_NAME:?Set AWS_S3_BUCKET_NAME}"

MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"
MINIO_API_PORT="${MINIO_API_PORT:-9010}"
MINIO_URL="${MINIO_URL:-http://host.docker.internal:${MINIO_API_PORT}}"
PREFIX="${AWS_S3_PREFIX:-products}"
PREFIX="${PREFIX#/}"
PREFIX="${PREFIX%/}"

S3_HOST="https://s3.${AWS_REGION}.amazonaws.com"
if [[ "$AWS_REGION" == "us-east-1" ]]; then
  S3_HOST="https://s3.amazonaws.com"
fi

SRC="local/${AWS_S3_BUCKET_NAME}/${PREFIX}"
DST="aws/${AWS_S3_BUCKET_NAME}/${PREFIX}"

echo "Source: ${MINIO_URL} → ${SRC}"
echo "Target: ${S3_HOST} → ${DST}"
echo "Command: mc mirror ${DRY_FLAG} …"

run_inner() {
  if [[ "${MC_USE_LOCAL_MC:-0}" == 1 ]] && command -v mc >/dev/null 2>&1; then
    export MINIO_URL MINIO_ROOT_USER MINIO_ROOT_PASSWORD
    export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION
    export AWS_S3_BUCKET_NAME S3_HOST PREFIX DRY_FLAG
    /bin/sh -c '
      set -eu
      mc alias set local "$MINIO_URL" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
      mc alias set aws "$S3_HOST" "$AWS_ACCESS_KEY_ID" "$AWS_SECRET_ACCESS_KEY" --api S3v4
      if [ -n "$DRY_FLAG" ]; then
        mc mirror --dry-run "local/${AWS_S3_BUCKET_NAME}/${PREFIX}" "aws/${AWS_S3_BUCKET_NAME}/${PREFIX}"
      else
        mc mirror "local/${AWS_S3_BUCKET_NAME}/${PREFIX}" "aws/${AWS_S3_BUCKET_NAME}/${PREFIX}"
      fi
    '
    return
  fi
  # shellcheck disable=SC2086
  docker run --rm -i \
    ${MC_HOST_EXTRA:-} \
    --add-host=host.docker.internal:host-gateway \
    --entrypoint /bin/sh \
    -e MINIO_URL -e MINIO_ROOT_USER -e MINIO_ROOT_PASSWORD \
    -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_REGION \
    -e AWS_S3_BUCKET_NAME -e S3_HOST -e PREFIX -e DRY_FLAG \
    minio/mc:latest \
    -c '
      set -eu
      mc alias set local "$MINIO_URL" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
      mc alias set aws "$S3_HOST" "$AWS_ACCESS_KEY_ID" "$AWS_SECRET_ACCESS_KEY" --api S3v4
      if [ -n "$DRY_FLAG" ]; then
        mc mirror --dry-run "local/${AWS_S3_BUCKET_NAME}/${PREFIX}" "aws/${AWS_S3_BUCKET_NAME}/${PREFIX}"
      else
        mc mirror "local/${AWS_S3_BUCKET_NAME}/${PREFIX}" "aws/${AWS_S3_BUCKET_NAME}/${PREFIX}"
      fi
    '
}

run_inner
echo "Done."
