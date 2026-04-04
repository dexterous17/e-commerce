import { query } from "../config/db.js";

export async function deleteAllSeedManifest(client) {
  await query(`DELETE FROM seed_manifest`, [], client);
}

export async function upsertSeedManifest(
  {
    source,
    generatedAt = new Date().toISOString(),
    bucketName = null,
    bucketRegion = null,
    bucketPublicBaseUrl = null,
    bucketPrefix = null,
    stats = {},
    rawManifest = {},
  },
  { client } = {}
) {
  if (!source) {
    throw new Error("Seed manifest source is required");
  }

  await query(
    `INSERT INTO seed_manifest (
      source,
      generated_at,
      bucket_name,
      bucket_region,
      bucket_public_base_url,
      bucket_prefix,
      stats,
      raw_manifest
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (source) DO UPDATE
    SET generated_at = excluded.generated_at,
        bucket_name = excluded.bucket_name,
        bucket_region = excluded.bucket_region,
        bucket_public_base_url = excluded.bucket_public_base_url,
        bucket_prefix = excluded.bucket_prefix,
        stats = excluded.stats,
        raw_manifest = excluded.raw_manifest,
        updated_at = NOW()`,
    [
      source,
      generatedAt,
      bucketName,
      bucketRegion,
      bucketPublicBaseUrl,
      bucketPrefix,
      JSON.stringify(stats || {}),
      JSON.stringify(rawManifest || {}),
    ],
    client
  );
}
