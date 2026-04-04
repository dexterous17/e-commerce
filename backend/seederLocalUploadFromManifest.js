/**
 * Seed Postgres from backend/data/products-s3-manifest.json using local files under backend/upload/.
 * Expects product image URLs in the manifest to be /upload/... (run syncS3ToLocalUpload.js --rewrite-manifest first),
 * or still be HTTPS S3 URLs (they are mapped to /upload/... using manifest bucket metadata).
 *
 * Does not call S3. Clears per-product bucket columns.
 *
 *   node seederLocalUploadFromManifest.js
 *   node seederLocalUploadFromManifest.js -d
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import colors from "colors";

import "./config/loadEnv.js";
import users from "./data/users.js";

import connectDB, { withTransaction } from "./config/db.js";
import {
  deleteAllSeedManifest,
  upsertSeedManifest,
} from "./models/seedManifestModel.js";
import { deleteAllOrders } from "./models/orderModel.js";
import { deleteAllProducts, insertProducts } from "./models/productModel.js";
import { deleteAllUsers, insertUsers } from "./models/userModel.js";
import { extractS3KeyFromUrl } from "./utils/mediaImageUrls.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manifestPath = path.join(__dirname, "data", "products-s3-manifest.json");

function manifestToProductMeta(manifest) {
  const b = manifest.bucket;
  if (!b?.name) return null;
  return {
    bucketName: b.name,
    bucketRegion: b.region || process.env.AWS_REGION?.trim(),
    bucketPublicBaseUrl: b.publicBaseUrl || null,
    bucketPrefix: b.prefix != null ? String(b.prefix) : null,
  };
}

/** Supports manifests that still have `bucket` or are fully local (`/upload/...` only). */
function resolveManifestMeta(manifest) {
  const fromFile = manifestToProductMeta(manifest);
  if (fromFile) return fromFile;

  const hasHttps = (manifest.products || []).some((p) =>
    (p.images || []).some((u) => /^https?:\/\//i.test(String(u)))
  );
  if (!hasHttps) {
    return {
      bucketName: null,
      bucketRegion: null,
      bucketPublicBaseUrl: null,
      bucketPrefix: null,
    };
  }

  const bucketName = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME;
  const bucketRegion = process.env.AWS_REGION?.trim();
  if (!bucketName || !bucketRegion) {
    throw new Error(
      "Manifest still has HTTPS image URLs but no bucket block; set AWS_S3_BUCKET_NAME and AWS_REGION, or run syncS3ToLocalUpload.js --rewrite-manifest first."
    );
  }

  return {
    bucketName,
    bucketRegion,
    bucketPublicBaseUrl: process.env.AWS_S3_PUBLIC_BASE_URL?.trim() || null,
    bucketPrefix: process.env.AWS_S3_PREFIX?.trim() || null,
  };
}

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

async function readManifest() {
  const raw = await fs.readFile(manifestPath, "utf8");
  return JSON.parse(raw);
}

function manifestProductToRow(product, adminUserId, meta) {
  const sourceImages = Array.isArray(product.images) ? product.images : [];
  const images = sourceImages.map((u) => toLocalUploadUrl(String(u), meta));
  const localImages = images
    .map((u) => {
      if (typeof u !== "string" || !u.startsWith("/upload/")) return null;
      const key = u.slice("/upload/".length);
      return toLocalRepoPath(key);
    })
    .filter(Boolean);

  return {
    name: product.name,
    description: product.description,
    sex: product.sex || null,
    category: product.category,
    subCategory: product.subCategory || null,
    size: product.size || null,
    nwt: Boolean(product.nwt),
    brand: product.brand || null,
    color: product.color,
    subColor: product.subColor || null,
    price: Number(product.price || 0),
    countInStock: Number(product.countInStock ?? 1),
    images,
    localImages,
    user: adminUserId,
    bucketName: null,
    bucketRegion: null,
    bucketPublicBaseUrl: null,
    bucketPrefix: null,
    seedSource: "products-local-upload-manifest",
  };
}

const importData = async () => {
  try {
    const manifest = await readManifest();
    const meta = resolveManifestMeta(manifest);

    const products = Array.isArray(manifest.products) ? manifest.products : [];
    if (products.length === 0) {
      throw new Error("Manifest has no products");
    }

    await connectDB();

    await withTransaction(async (client) => {
      await deleteAllSeedManifest(client);
      await deleteAllOrders(client);
      await deleteAllProducts(client);
      await deleteAllUsers(client);

      const createdUsers = await insertUsers(users, client);
      const adminUser = createdUsers[0]._id;
      const sampleProducts = products.map((p) =>
        manifestProductToRow(p, adminUser, meta)
      );

      await insertProducts(sampleProducts, client);
      await upsertSeedManifest(
        {
          source: "products-local-upload-manifest",
          bucketName: null,
          bucketRegion: null,
          bucketPublicBaseUrl: null,
          bucketPrefix: null,
          stats: {
            ...(manifest.stats || {}),
            manifestSeededProducts: sampleProducts.length,
            localUploadRoot: "backend/upload",
          },
          rawManifest: {
            manifestPath: "backend/data/products-s3-manifest.json",
            generatedAt: manifest.generatedAt || null,
            mode: "local-upload",
          },
        },
        { client }
      );
    });

    console.log(
      "Database seeded from manifest (local /upload images).".green.inverse
    );
    process.exit();
  } catch (error) {
    console.error(`Error: ${error.message}`.red.inverse);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    await connectDB();
    await withTransaction(async (client) => {
      await deleteAllSeedManifest(client);
      await deleteAllOrders(client);
      await deleteAllProducts(client);
      await deleteAllUsers(client);
    });
    console.log("Data has been destroyed!".red.inverse);
    process.exit();
  } catch (error) {
    console.error(`Error: ${error.message}`.red.inverse);
    process.exit(1);
  }
};

if (process.argv[2] === "-d") {
  destroyData();
} else {
  importData();
}
