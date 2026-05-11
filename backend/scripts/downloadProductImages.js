import fs from "fs/promises";
import http from "http";
import https from "https";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(backendRoot, "..");

const args = process.argv.slice(2);

function getArg(flag, fallback) {
  const index = args.indexOf(flag);

  if (index === -1 || index === args.length - 1) {
    return fallback;
  }

  return args[index + 1];
}

function hasFlag(flag) {
  return args.includes(flag);
}

function resolveFromRepo(value) {
  if (!value) {
    return value;
  }

  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getExtension(urlString, contentType = "") {
  const pathname = new URL(urlString).pathname;
  const extension = path.extname(pathname).toLowerCase();

  if (extension) {
    return extension;
  }

  if (contentType.includes("png")) {
    return ".png";
  }

  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    return ".jpg";
  }

  if (contentType.includes("webp")) {
    return ".webp";
  }

  return ".jpg";
}

function downloadBuffer(urlString, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const transport = urlString.startsWith("https:") ? https : http;
    const request = transport.get(
      urlString,
      {
        headers: {
          "User-Agent": "codex-product-image-downloader",
        },
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;

        if (
          statusCode >= 300 &&
          statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();

          if (redirectCount >= 5) {
            reject(new Error("Too many redirects"));
            return;
          }

          const nextUrl = new URL(response.headers.location, urlString).toString();
          resolve(downloadBuffer(nextUrl, redirectCount + 1));
          return;
        }

        if (statusCode !== 200) {
          response.resume();
          reject(new Error(`Request failed with status ${statusCode}`));
          return;
        }

        const chunks = [];

        response.on("data", (chunk) => {
          chunks.push(chunk);
        });

        response.on("end", () => {
          resolve({
            buffer: Buffer.concat(chunks),
            contentType: String(response.headers["content-type"] || ""),
          });
        });

        response.on("error", reject);
      }
    );

    request.setTimeout(30000, () => {
      request.destroy(new Error("Request timed out after 30 seconds"));
    });

    request.on("error", reject);
  });
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

async function loadProducts(sourceFile) {
  const moduleUrl = pathToFileURL(sourceFile).href;
  const imported = await import(moduleUrl);

  if (!Array.isArray(imported.default)) {
    throw new Error(`Expected default export to be an array in ${sourceFile}`);
  }

  return imported.default;
}

async function fileExists(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile() && stats.size > 0;
  } catch {
    return false;
  }
}

async function main() {
  const sourceFile = resolveFromRepo(
    getArg("--source", "backend/data/products.js")
  );
  const outputDir = resolveFromRepo(
    getArg("--output-dir", "backend/uploads/products")
  );
  const concurrency = Number.parseInt(getArg("--concurrency", "8"), 10);
  const limitArg = getArg("--limit", "");
  const limit = limitArg ? Number.parseInt(limitArg, 10) : null;

  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("--concurrency must be a positive integer");
  }

  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
    throw new Error("--limit must be a positive integer");
  }

  const products = await loadProducts(sourceFile);
  const selectedProducts = limit ? products.slice(0, limit) : products;
  const jobs = [];

  for (const [productIndex, product] of selectedProducts.entries()) {
    const productSlug = slugify(product.name || `product-${productIndex + 1}`);
    const productDirName = `${String(productIndex + 1).padStart(4, "0")}-${productSlug}`;
    const productDir = path.join(outputDir, productDirName);
    const imageUrls = Array.isArray(product.images)
      ? product.images.filter((imageUrl) => typeof imageUrl === "string" && imageUrl.trim())
      : [];

    for (const [imageIndex, imageUrl] of imageUrls.entries()) {
      const extension = getExtension(imageUrl);
      const fileName = `${String(imageIndex + 1).padStart(2, "0")}${extension}`;

      jobs.push({
        productDir,
        productDirName,
        productIndex,
        imageIndex,
        imageUrl,
        outputPath: path.join(productDir, fileName),
      });
    }
  }

  await fs.mkdir(outputDir, { recursive: true });

  console.log(`Source file: ${sourceFile}`);
  console.log(`Output dir: ${outputDir}`);
  console.log(`Products: ${selectedProducts.length}/${products.length}`);
  console.log(`Images queued: ${jobs.length}`);

  let downloadedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let completedCount = 0;
  const failures = [];

  await mapWithConcurrency(jobs, concurrency, async (job) => {
    try {
      await fs.mkdir(job.productDir, { recursive: true });

      if (await fileExists(job.outputPath)) {
        skippedCount += 1;
        return;
      }

      const { buffer, contentType } = await downloadBuffer(job.imageUrl);
      const preferredExtension = getExtension(job.imageUrl, contentType);
      const outputPathWithContentType = job.outputPath.replace(
        /\.[^.]+$/,
        preferredExtension
      );

      await fs.writeFile(outputPathWithContentType, buffer);
      downloadedCount += 1;
    } catch (error) {
      failedCount += 1;
      failures.push({
        product: job.productDirName,
        imageNumber: job.imageIndex + 1,
        url: job.imageUrl,
        message: error.message,
      });
    } finally {
      completedCount += 1;

      if (completedCount % 50 === 0 || completedCount === jobs.length) {
        console.log(
          `[${completedCount}/${jobs.length}] downloaded=${downloadedCount} skipped=${skippedCount} failed=${failedCount}`
        );
      }
    }
  });

  if (failures.length > 0) {
    const failuresPath = path.join(outputDir, "download-failures.json");
    await fs.writeFile(failuresPath, JSON.stringify(failures, null, 2));
    console.log(`Failure details written to ${failuresPath}`);
  }

  console.log("Download complete.");
  console.log(`Downloaded: ${downloadedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Failed: ${failedCount}`);

  if (hasFlag("--strict") && failedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
