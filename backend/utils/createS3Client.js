import { S3Client } from "@aws-sdk/client-s3";

/**
 * S3-compatible client: real **AWS S3** by default, or **local MinIO** when `AWS_S3_ENDPOINT_URL` is set.
 * Production buckets live in AWS (you supply credentials). Local dev typically uses MinIO in Docker
 * with path-style URLs (`AWS_S3_FORCE_PATH_STYLE=true`).
 *
 * @param {object} [overrides] Extra `S3Client` options (e.g. `{ region: "us-west-2" }`).
 */
export function createS3Client(overrides = {}) {
  const { region: regionOverride, ...s3Overrides } = overrides;
  const region = (
    regionOverride ||
    process.env.AWS_REGION ||
    "us-east-1"
  ).trim();
  const endpoint = (process.env.AWS_S3_ENDPOINT_URL || "").trim();
  const ftp = process.env.AWS_S3_FORCE_PATH_STYLE;
  const forcePathStyle =
    ftp === "true" || (ftp !== "false" && endpoint.length > 0);

  return new S3Client({
    region,
    ...(endpoint ? { endpoint, forcePathStyle } : {}),
    ...s3Overrides,
  });
}
