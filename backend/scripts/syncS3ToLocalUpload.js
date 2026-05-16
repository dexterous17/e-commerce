/**
 * Download S3 objects (default: AWS_S3_PREFIX under AWS_S3_BUCKET_NAME) into backend/upload/
 * preserving object keys. Optional: rewrite products-s3-manifest.json and/or Postgres URLs to /upload/...
 *
 * Usage (from repo root, with env/aws/.env credentials):
 *   cd backend && node scripts/syncS3ToLocalUpload.js
 *   node scripts/syncS3ToLocalUpload.js --skip-download --rewrite-manifest --update-database
 *
 * Flags:
 *   --skip-download     Only rewrite manifest / DB (files must already exist under upload/)
 *   --rewrite-manifest  Rewrite backend/data/products-s3-manifest.json image URLs to local paths
 *   --update-database   Rewrite products.images, products.local_images, order_items.images; clear product bucket columns
 *   --manifest PATH     Manifest file for --rewrite-manifest (default: backend/data/products-s3-manifest.json)
 *   --concurrency N     Parallel S3 downloads (default: 12)
 *   --prefix PREFIX     Override AWS_S3_PREFIX (empty = entire bucket)
 */

import { createWriteStream } from "fs";
import fs from "fs/promises";
import path from "path";
import { pipeline } from "stream/promises";
import { fileURLToPath } from "url";

import colors from "colors";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

import "../config/loadEnv.js";
import { createS3Client } from "../utils/createS3Client.js";
import connectDB, { query } from "../config/db.js";
import { extractS3KeyFromUrl } from "../utils/mediaImageUrls.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, "..");
const defaultManifestPath = path.join(backendRoot, "data", "products-s3-manifest.json");
const uploadRoot = path.join(backendRoot, "upload");

const args = process.argv.slice(2);

function hasFlag(name) {
  return args.includes(name);
}

function getArg(flag, fallback) {
  const i = args.indexOf(flag);
  if (i === -1 || i === args.length - 1) return fallback;
  return args[i + 1];
}

function trimSlashes(value) {
  return String(value || "").replace(/^\/+|\/+$/g, "");
}

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function getBucketName() {
  return process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || "";
}

function manifestToProductMeta(manifest) {
  const b = manifest?.bucket;
  if (!b?.name) return null;
  return {
    bucketName: b.name,
    bucketRegion: b.region || process.env.AWS_REGION?.trim(),
    bucketPublicBaseUrl: b.publicBaseUrl || null,
    bucketPrefix: b.prefix != null ? String(b.prefix) : null,
  };
}

function rowToProductMeta(row) {
  return {
    bucketName: row.bucket_name || null,
    bucketRegion: row.bucket_region || null,
    bucketPublicBaseUrl: row.bucket_public_base_url || null,
    bucketPrefix: row.bucket_prefix || null,
  };
}

/** Map a stored image URL to `/upload/<s3-key>` when possible. */
function toLocalUploadUrl(imageUrl, meta) {
  if (imageUrl == null || typeof imageUrl !== "string") return imageUrl;
  const t = imageUrl.trim();
  if (t.startsWith("/upload/")) return t;
  const key = extractS3KeyFromUrl(t, meta);
  if (key) return `/upload/${key}`;
  return imageUrl;
}

function toLocalRepoPath(key) {
  if (!key) return null;
  return path.posix.join("backend", "upload", key.replace(/\\/g, "/"));
}

async function mapWithConcurrency(items, concurrency, mapper) {
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) return;
      await mapper(items[currentIndex], currentIndex);
    }
  }
  const n = Math.min(Math.max(1, concurrency), items.length || 1);
  await Promise.all(Array.from({ length: n }, () => worker()));
}

async function listAllKeys(client, bucket, prefix) {
  const keys = [];
  let token;
  do {
    const out = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        ContinuationToken: token,
      })
    );
    for (const obj of out.Contents || []) {
      if (obj.Key && !obj.Key.endsWith("/")) {
        keys.push(obj.Key);
      }
    }
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function downloadObject(client, bucket, key, destPath) {
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  const out = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  const body = out.Body;
  if (body && typeof body.pipe === "function") {
    await pipeline(body, createWriteStream(destPath));
    return;
  }
  const bytes = await out.Body.transformToByteArray();
  await fs.writeFile(destPath, Buffer.from(bytes));
}

async function runDownload() {
  const region = requireEnv("AWS_REGION");
  const bucket = getBucketName();
  if (!bucket) {
    throw new Error("Missing AWS_S3_BUCKET_NAME (or AWS_BUCKET_NAME)");
  }
  const prefix = trimSlashes(
    getArg("--prefix", trimSlashes(process.env.AWS_S3_PREFIX || "products"))
  );
  const concurrency = Number.parseInt(getArg("--concurrency", "12"), 10);
  if (!Number.isFinite(concurrency) || concurrency < 1) {
    throw new Error("--concurrency must be a positive number");
  }

  const client = createS3Client({ region });
  console.log(
    `Listing s3://${bucket}/${prefix ? `${prefix}/` : ""} …`.cyan
  );
  const keys = await listAllKeys(client, bucket, prefix ? `${prefix}/` : "");
  if (keys.length === 0) {
    console.log("No objects to download.".yellow);
    return;
  }
  console.log(`Downloading ${keys.length} object(s) → ${uploadRoot}`.cyan);

  let done = 0;
  await mapWithConcurrency(keys, concurrency, async (key) => {
    const dest = path.join(uploadRoot, key);
    await downloadObject(client, bucket, key, dest);
    done += 1;
    if (done % 100 === 0 || done === keys.length) {
      console.log(`[${done}/${keys.length}]`.cyan);
    }
  });
  console.log("Download complete.".green);
}

async function rewriteManifest(manifestPath) {
  const raw = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw);
  const meta = manifestToProductMeta(manifest);
  if (!meta) {
    throw new Error("Manifest missing bucket metadata (needed to map S3 URLs)");
  }
  const products = Array.isArray(manifest.products) ? manifest.products : [];
  for (const p of products) {
    const imgs = Array.isArray(p.images) ? p.images : [];
    p.images = imgs.map((u) => toLocalUploadUrl(u, meta));
    p.localImages = imgs
      .map((u) => {
        const s = String(u);
        if (s.startsWith("/upload/")) {
          return toLocalRepoPath(s.slice("/upload/".length));
        }
        const key = extractS3KeyFromUrl(s, meta);
        return key ? toLocalRepoPath(key) : null;
      })
      .filter(Boolean);
  }
  manifest.localMedia = {
    generatedAt: new Date().toISOString(),
    root: "backend/upload",
    publicPathPrefix: "/upload",
    note: "Images served from Express static /upload (see server.js).",
  };
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Manifest rewritten: ${manifestPath}`.green);
}

function parseJsonStringArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String);
  }
  if (typeof value === "string") {
    try {
      const p = JSON.parse(value);
      return Array.isArray(p) ? p.filter(Boolean).map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function updateDatabase() {
  await connectDB();

  const { rows: prows } = await query(
    `SELECT _id, images, local_images, bucket_name, bucket_region, bucket_public_base_url, bucket_prefix
     FROM products`
  );

  for (const row of prows) {
    const meta = rowToProductMeta(row);
    const images = parseJsonStringArray(row.images);
    const newImages = images.map((u) => toLocalUploadUrl(String(u), meta));
    const newLocal = newImages
      .map((u) => {
        if (typeof u !== "string" || !u.startsWith("/upload/")) return null;
        const key = u.slice("/upload/".length);
        return toLocalRepoPath(key);
      })
      .filter(Boolean);

    await query(
      `UPDATE products
       SET images = $1,
           local_images = $2,
           bucket_name = NULL,
           bucket_region = NULL,
           bucket_public_base_url = NULL,
           bucket_prefix = NULL,
           updated_at = NOW()
       WHERE _id = $3`,
      [JSON.stringify(newImages), JSON.stringify(newLocal), row._id]
    );
  }
  console.log(`Updated ${prows.length} product row(s).`.green);

  const metaFromEnv = {
    bucketName: getBucketName() || null,
    bucketRegion: process.env.AWS_REGION?.trim() || null,
    bucketPublicBaseUrl: process.env.AWS_S3_PUBLIC_BASE_URL?.trim() || null,
    bucketPrefix: process.env.AWS_S3_PREFIX?.trim() || null,
  };

  const { rows: orows } = await query(
    `SELECT _id, images FROM order_items`
  );
  let orderUpdates = 0;
  for (const row of orows) {
    const images = parseJsonStringArray(row.images);
    const newImages = images.map((u) => toLocalUploadUrl(String(u), metaFromEnv));
    const changed =
      JSON.stringify(images) !== JSON.stringify(newImages);
    if (changed) {
      await query(
        `UPDATE order_items SET images = $1, updated_at = NOW() WHERE _id = $2`,
        [JSON.stringify(newImages), row._id]
      );
      orderUpdates += 1;
    }
  }
  if (orderUpdates > 0) {
    console.log(`Updated ${orderUpdates} order line item row(s).`.green);
  }

  await query(
    `UPDATE seed_manifest
     SET bucket_name = NULL,
         bucket_region = NULL,
         bucket_public_base_url = NULL,
         bucket_prefix = NULL,
         updated_at = NOW()
     WHERE source = 'products-s3-manifest'`
  );
  console.log("Cleared S3 bucket columns on seed_manifest (if present).".green);
}

async function main() {
  const skipDownload = hasFlag("--skip-download");
  const rewrite = hasFlag("--rewrite-manifest");
  const updateDb = hasFlag("--update-database");
  const manifestIdx = args.indexOf("--manifest");
  const manifestPath =
    manifestIdx !== -1 && args[manifestIdx + 1]
      ? path.resolve(process.cwd(), args[manifestIdx + 1])
      : defaultManifestPath;

  if (!skipDownload) {
    await runDownload();
  } else {
    console.log("Skipping S3 download (--skip-download).".yellow);
  }

  if (rewrite) {
    await rewriteManifest(manifestPath);
  }

  if (updateDb) {
    await updateDatabase();
  }

  if (!rewrite && !updateDb && skipDownload) {
    console.log(
      "Nothing to do. Use --rewrite-manifest and/or --update-database.".yellow
    );
  }
}

main().catch((err) => {
  console.error(String(err.message || err).red);
  process.exit(1);
});
