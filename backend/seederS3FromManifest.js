import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import colors from "colors";
import { HeadObjectCommand } from "@aws-sdk/client-s3";

import { createS3Client } from "./utils/createS3Client.js";

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manifestPath = path.join(__dirname, "data", "products-s3-manifest.json");

const args = process.argv.slice(2);

function getArg(flag, fallback) {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) {
    return fallback;
  }
  return args[index + 1];
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function urlToS3Key(imageUrl) {
  const { pathname } = new URL(imageUrl);
  return decodeURIComponent(pathname.replace(/^\/+/, ""));
}

async function mapWithConcurrency(items, concurrency, mapper) {
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      await mapper(items[currentIndex], currentIndex);
    }
  }
  const workerCount = Math.min(concurrency, items.length || 1);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

async function readManifest() {
  const raw = await fs.readFile(manifestPath, "utf8");
  return JSON.parse(raw);
}

function manifestProductToRow(product, adminUserId, meta) {
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
    images: product.images || [],
    localImages: product.localImages || [],
    user: adminUserId,
    bucketName: meta.bucketName,
    bucketRegion: meta.bucketRegion,
    bucketPublicBaseUrl: meta.bucketPublicBaseUrl,
    bucketPrefix: meta.bucketPrefix,
    seedSource: "products-s3-manifest",
  };
}

const importData = async () => {
  try {
    const skipVerify = args.includes("--skip-verify");
    const concurrency = Number.parseInt(getArg("--concurrency", "16"), 10);
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new Error("--concurrency must be a positive integer");
    }

    const region = requireEnv("AWS_REGION");
    const manifest = await readManifest();
    const bucket = manifest.bucket;
    if (!bucket?.name) {
      throw new Error("Manifest missing bucket.name");
    }

    const bucketName = bucket.name;
    const bucketRegion = bucket.region || region;
    const bucketPublicBaseUrl = bucket.publicBaseUrl || null;
    const bucketPrefix = bucket.prefix != null ? String(bucket.prefix) : null;

    if (bucketName !== "bucket-7i9ax7") {
      console.warn(
        `Warning: manifest bucket is ${bucketName}, expected bucket-7i9ax7`.yellow
      );
    }

    const products = Array.isArray(manifest.products) ? manifest.products : [];
    if (products.length === 0) {
      throw new Error("Manifest has no products");
    }

    const imageUrls = [
      ...new Set(products.flatMap((p) => p.images || []).filter(Boolean)),
    ];

    await connectDB();

    const s3Client = createS3Client({ region: bucketRegion });
    let verified = 0;

    if (!skipVerify) {
      const missing = [];
      await mapWithConcurrency(imageUrls, concurrency, async (url) => {
        const key = urlToS3Key(url);
        try {
          await s3Client.send(
            new HeadObjectCommand({ Bucket: bucketName, Key: key })
          );
          verified += 1;
          if (verified % 100 === 0 || verified === imageUrls.length) {
            console.log(
              `[${verified}/${imageUrls.length}] Verified objects in S3`.cyan
            );
          }
        } catch (err) {
          missing.push({ url, key, code: err.name || err.Code });
        }
      });

      if (missing.length > 0) {
        const sample = missing
          .slice(0, 15)
          .map((m) => `  ${m.key} (${m.code})`)
          .join("\n");
        throw new Error(
          `${missing.length} image object(s) missing in bucket ${bucketName} (product library / ${bucketPrefix || "prefix"}).\n` +
            `First keys:\n${sample}`
        );
      }
      console.log(
        `All ${imageUrls.length} image URLs resolve to existing S3 objects.`.green
      );
    } else {
      console.log("Skipping S3 HeadObject verification (--skip-verify).".yellow);
    }

    await withTransaction(async (client) => {
      await deleteAllSeedManifest(client);
      await deleteAllOrders(client);
      await deleteAllProducts(client);
      await deleteAllUsers(client);

      const createdUsers = await insertUsers(users, client);
      const adminUser = createdUsers[0]._id;
      const meta = {
        bucketName,
        bucketRegion,
        bucketPublicBaseUrl,
        bucketPrefix,
      };
      const sampleProducts = products.map((p) =>
        manifestProductToRow(p, adminUser, meta)
      );

      await insertProducts(sampleProducts, client);
      await upsertSeedManifest(
        {
          source: "products-s3-manifest",
          bucketName,
          bucketRegion,
          bucketPublicBaseUrl,
          bucketPrefix,
          stats: {
            ...(manifest.stats || {}),
            manifestSeededProducts: sampleProducts.length,
            verifiedImageUrls: skipVerify ? null : imageUrls.length,
          },
          rawManifest: {
            manifestPath: "backend/data/products-s3-manifest.json",
            generatedAt: manifest.generatedAt || null,
            skipVerify,
          },
        },
        { client }
      );
    });

    console.log(
      "Database seeded from S3 manifest (images already in bucket).".green.inverse
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
