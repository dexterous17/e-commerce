#!/bin/sh
# Run inside minio/mc container (see docker-compose.yml minio-init).
# Creates the bucket on local MinIO only — not on AWS (you create the AWS bucket yourself).
set -eu
mc alias set local "${MINIO_HOST:-http://minio:9000}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}"
mc mb "local/${BUCKET_NAME}" --ignore-existing
echo "MinIO bucket ready: ${BUCKET_NAME}"
