import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import colors from "colors";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import "../config/loadEnv.js";
import products, { localImageStats } from "../data/productsWithLocalImages.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const localImagesRoot = path.join(repoRoot, "backend", "uploads", "products");
const args = process.argv.slice(2);

function getArg(flag, fallback) {
  const index = args.indexOf(flag);

  if (index === -1 || index === args.length - 1) {
    return fallback;
  }

  return args[index + 1];
}

function trimSlashes(value) {
  return String(value || "").replace(/^\/+|\/+$/g, "");
}

function normalizePublicBaseUrl(value) {
  const trimmed = trimSlashes(value);

  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getBucketName() {
  return process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME;
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  if (extension === ".jpeg" || extension === ".jpg") {
    return "image/jpeg";
  }

  return "application/octet-stream";
}

function encodeObjectKey(key) {
  return key.split("/").map(encodeURIComponent).join("/");
}

function buildPublicUrl(bucketName, region, objectKey) {
  const encodedKey = encodeObjectKey(objectKey);
  const publicBaseUrl = normalizePublicBaseUrl(
    process.env.AWS_S3_PUBLIC_BASE_URL
  );

  if (publicBaseUrl) {
    return `${publicBaseUrl}/${encodedKey}`;
  }

  if (bucketName.includes(".")) {
    return `https://s3.${region}.amazonaws.com/${encodeURIComponent(
      bucketName
    )}/${encodedKey}`;
  }

  return `https://${bucketName}.s3.${region}.amazonaws.com/${encodedKey}`;
}

function resolveFromRepo(relativePath) {
  if (path.isAbsolute(relativePath)) {
    return relativePath;
  }

  return path.resolve(repoRoot, relativePath);
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

async function main() {
  const region = requireEnv("AWS_REGION");
  const bucketName = getBucketName();
  const prefix =
    process.env.AWS_S3_PREFIX === undefined
      ? "products"
      : trimSlashes(process.env.AWS_S3_PREFIX);
  const concurrency = Number.parseInt(getArg("--concurrency", "8"), 10);
  const outputFile = resolveFromRepo(
    getArg("--output", "backend/data/products-s3-manifest.json")
  );

  if (!bucketName) {
    throw new Error(
      "Missing required environment variable: AWS_S3_BUCKET_NAME (or AWS_BUCKET_NAME)"
    );
  }

  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("--concurrency must be a positive integer");
  }

  const s3Client = new S3Client({ region });
  const uploadJobs = products.flatMap((product) =>
    product.images.map((imagePath) => {
      const absoluteFilePath = path.resolve(repoRoot, imagePath);
      const relativeImageKey = path
        .relative(localImagesRoot, absoluteFilePath)
        .replace(/\\/g, "/");
      const objectKey = prefix ? `${prefix}/${relativeImageKey}` : relativeImageKey;

      return {
        imagePath,
        absoluteFilePath,
        objectKey,
      };
    })
  );

  console.log(
    `Uploading ${uploadJobs.length} images for ${products.length} products to ${bucketName}`.cyan
  );

  const uploadedUrls = new Map();
  let completedUploads = 0;

  await mapWithConcurrency(uploadJobs, concurrency, async (job) => {
    const body = await fs.readFile(job.absoluteFilePath);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: job.objectKey,
        Body: body,
        ContentType: getContentType(job.absoluteFilePath),
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    uploadedUrls.set(
      job.imagePath,
      buildPublicUrl(bucketName, region, job.objectKey)
    );

    completedUploads += 1;

    if (completedUploads % 50 === 0 || completedUploads === uploadJobs.length) {
      console.log(`[${completedUploads}/${uploadJobs.length}] Uploaded`.cyan);
    }
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    bucket: {
      name: bucketName,
      region,
      publicBaseUrl:
        normalizePublicBaseUrl(process.env.AWS_S3_PUBLIC_BASE_URL) ||
        `https://${bucketName}.s3.${region}.amazonaws.com`,
      prefix: prefix || null,
    },
    stats: {
      ...localImageStats,
      uploadedImages: uploadJobs.length,
    },
    products: products.map((product) => ({
      ...product,
      localImages: product.images,
      images: product.images
        .map((imagePath) => uploadedUrls.get(imagePath))
        .filter(Boolean),
    })),
  };

  await fs.writeFile(outputFile, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`Manifest written to ${outputFile}`.green);
}

main().catch((error) => {
  console.error(error.message.red);
  process.exit(1);
});
