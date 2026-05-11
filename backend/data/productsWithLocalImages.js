import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import products from "./products.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(backendRoot, "..");
const localImagesRoot = path.join(backendRoot, "uploads", "products");

export function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function getProductImageDirectoryName(product, index) {
  const slug = slugify(product.name || `product-${index + 1}`);
  return `${String(index + 1).padStart(4, "0")}-${slug}`;
}

export function getLocalImagesForProduct(product, index) {
  const directoryName = getProductImageDirectoryName(product, index);
  const directoryPath = path.join(localImagesRoot, directoryName);

  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs
    .readdirSync(directoryPath)
    .filter((fileName) =>
      fs.statSync(path.join(directoryPath, fileName)).isFile()
    )
    .sort((left, right) =>
      left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" })
    )
    .map((fileName) =>
      path.relative(repoRoot, path.join(directoryPath, fileName)).replace(/\\/g, "/")
    );
}

const productsWithLocalImages = products
  .map((product, index) => ({
    ...product,
    images: getLocalImagesForProduct(product, index),
  }))
  .filter((product) => product.images.length > 0);

export const localImageStats = {
  sourceProducts: products.length,
  keptProducts: productsWithLocalImages.length,
  keptImages: productsWithLocalImages.reduce(
    (total, product) => total + product.images.length,
    0
  ),
};

export default productsWithLocalImages;
