import fs from "fs/promises";
import colors from "colors";
import path from "path";
import { fileURLToPath } from "url";
import { PutObjectCommand } from "@aws-sdk/client-s3";

import { createS3Client } from "./utils/createS3Client.js";

import { syncAwsS3EnvFromBackendFile } from "./config/loadEnv.js";
import connectDB, {
  withTransaction,
  resolveDatabaseConnectionString,
} from "./config/db.js";
import users from "./data/users.js";
import products, { localImageStats } from "./data/productsWithLocalImages.js";

import {
  deleteAllSeedManifest,
  upsertSeedManifest,
} from "./models/seedManifestModel.js";
import { deleteAllOrders } from "./models/orderModel.js";
import { deleteAllProducts, insertProducts } from "./models/productModel.js";
import { deleteAllUsers, insertUsers } from "./models/userModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const localImagesRoot = path.join(__dirname, "uploads", "products");
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

function maskDbUrl(url) {
  if (!url) return "(none)";
  return url.replace(/:[^:@/]+@/, ":****@");
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
  const publicBaseUrl = normalizePublicBaseUrl(
    process.env.AWS_S3_PUBLIC_BASE_URL
  );
  const encodedKey = encodeObjectKey(objectKey);

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

function buildPublicBaseUrl(bucketName, region) {
  const publicBaseUrl = normalizePublicBaseUrl(
    process.env.AWS_S3_PUBLIC_BASE_URL
  );

  if (publicBaseUrl) {
    return publicBaseUrl;
  }

  if (bucketName.includes(".")) {
    return `https://s3.${region}.amazonaws.com/${encodeURIComponent(
      bucketName
    )}`;
  }

  return `https://${bucketName}.s3.${region}.amazonaws.com`;
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

const importData = async () => {
  try {
    syncAwsS3EnvFromBackendFile({ force: true });

    let dbUrl;
    try {
      dbUrl = resolveDatabaseConnectionString();
    } catch (e) {
      throw new Error(
        `${e.message} Use backend/db/.env or env/database/.env with a postgresql:// URL.`
      );
    }
    if (!dbUrl) {
      throw new Error(
        "DATABASE_URL is not set (or PGHOST/PGUSER/PGDATABASE incomplete). See backend/db/.env.example."
      );
    }

    const region = requireEnv("AWS_REGION");
    const bucketName = getBucketName();
    const prefix =
      process.env.AWS_S3_PREFIX === undefined
        ? "products"
        : trimSlashes(process.env.AWS_S3_PREFIX);
    const concurrency = Number.parseInt(getArg("--concurrency", "8"), 10);

    if (!bucketName) {
      throw new Error(
        "Missing required environment variable: AWS_S3_BUCKET_NAME (or AWS_BUCKET_NAME)"
      );
    }

    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new Error("--concurrency must be a positive integer");
    }

    console.log(`[seederS3] PostgreSQL: ${maskDbUrl(dbUrl)}`.cyan);
    console.log(
      `[seederS3] S3 uploads: s3://${bucketName}/${prefix ? `${prefix}/` : ""} (${region})`.cyan
    );

    await connectDB();

    const s3Client = createS3Client();
    const publicBaseUrl = buildPublicBaseUrl(bucketName, region);

    console.log(
      `Preparing ${localImageStats.keptProducts} products with ${localImageStats.keptImages} live images for S3 upload`.cyan
    );

    const uploadJobs = products.flatMap((product) =>
      product.images.map((imagePath) => {
        const absoluteFilePath = path.resolve(repoRoot, imagePath);
        const relativeImageKey = path
          .relative(localImagesRoot, absoluteFilePath)
          .replace(/\\/g, "/");
        const objectKey = prefix
          ? `${prefix}/${relativeImageKey}`
          : relativeImageKey;

        return {
          imagePath,
          absoluteFilePath,
          objectKey,
        };
      })
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
        console.log(
          `[${completedUploads}/${uploadJobs.length}] Uploaded to S3`.cyan
        );
      }
    });

    await withTransaction(async (client) => {
      await deleteAllSeedManifest(client);
      await deleteAllOrders(client);
      await deleteAllProducts(client);
      await deleteAllUsers(client);

      const createdUsers = await insertUsers(users, client);
      const adminUser = createdUsers[0]._id;
      const sampleProducts = products.map((product) => ({
        ...product,
        images: product.images
          .map((imagePath) => uploadedUrls.get(imagePath))
          .filter(Boolean),
        localImages: product.images,
        user: adminUser,
        bucketName,
        bucketRegion: region,
        bucketPublicBaseUrl: publicBaseUrl,
        bucketPrefix: prefix || null,
        seedSource: "products-s3-manifest",
      }));

      await insertProducts(sampleProducts, client);
      await upsertSeedManifest(
        {
          source: "products-s3-manifest",
          bucketName,
          bucketRegion: region,
          bucketPublicBaseUrl: publicBaseUrl,
          bucketPrefix: prefix || null,
          stats: {
            sourceProducts: localImageStats.sourceProducts,
            keptProducts: localImageStats.keptProducts,
            keptImages: localImageStats.keptImages,
            uploadedImages: uploadJobs.length,
          },
          rawManifest: {
            bucketName,
            region,
            prefix: prefix || null,
            publicBaseUrl,
            uploadedImages: uploadJobs.length,
            generatedAt: new Date().toISOString(),
          },
        },
        { client }
      );
    });

    console.log(
      "Data has been imported to Postgres with S3 image URLs!".green.inverse
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
