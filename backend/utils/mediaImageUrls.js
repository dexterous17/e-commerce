import { syncAwsS3EnvFromBackendFile } from "../config/loadEnv.js";

function trimSlashes(value) {
  return String(value || "").replace(/^\/+|\/+$/g, "");
}

function normalizePublicBaseUrl(value) {
  const trimmed = trimSlashes(value);

  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, "");
  }

  return `https://${trimmed}`.replace(/\/+$/, "");
}

function getBucketName() {
  return process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || "";
}

function encodeObjectKey(key) {
  return key.split("/").map((seg) => encodeURIComponent(seg)).join("/");
}

export function isImageProxyEnabled() {
  syncAwsS3EnvFromBackendFile();

  if (process.env.AWS_S3_IMAGE_PROXY === "false") {
    return false;
  }

  // Production: return direct S3 / AWS_S3_PUBLIC_BASE_URL links from APIs (not /api/media/s3).
  // Set AWS_S3_IMAGE_PROXY=true if the bucket is private and you need the backend proxy.
  const nodeEnv = process.env.NODE_ENV?.trim();
  if (nodeEnv === "production" && process.env.AWS_S3_IMAGE_PROXY !== "true") {
    return false;
  }

  let bucket = getBucketName();
  let region = process.env.AWS_REGION?.trim();
  if (!bucket || !region) {
    syncAwsS3EnvFromBackendFile({ force: true });
    bucket = getBucketName();
    region = process.env.AWS_REGION?.trim();
  }

  return Boolean(bucket && region);
}

export function buildPublicUrlForObjectKey(key) {
  const bucketName = getBucketName();
  const region = process.env.AWS_REGION?.trim();
  if (!bucketName || !region || !key) {
    return null;
  }

  const encodedKey = encodeObjectKey(key);
  const publicBaseUrl = normalizePublicBaseUrl(process.env.AWS_S3_PUBLIC_BASE_URL);

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

export function isValidObjectKey(key) {
  if (!key || typeof key !== "string") {
    return false;
  }

  const trimmed = key.trim();
  if (trimmed !== key || trimmed.length === 0) {
    return false;
  }

  if (trimmed.length > 1024 || trimmed.startsWith("/") || trimmed.includes("..")) {
    return false;
  }

  if (
    trimmed.includes("\\") ||
    trimmed.includes("//") ||
    trimmed.includes("?") ||
    trimmed.includes("*") ||
    trimmed.includes("[") ||
    trimmed.includes("]")
  ) {
    return false;
  }

  if (/[\x00-\x1f\x7f]/.test(trimmed)) {
    return false;
  }

  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return false;
  }

  if (decoded.includes("..") || decoded.startsWith("/") || /[\x00-\x1f\x7f]/.test(decoded)) {
    return false;
  }

  const envPrefix = trimSlashes(process.env.AWS_S3_PREFIX);
  if (envPrefix && trimmed !== envPrefix && !trimmed.startsWith(`${envPrefix}/`)) {
    return false;
  }

  return true;
}

function collectPublicBasePrefixes(product) {
  const bases = new Set();

  const envBase = normalizePublicBaseUrl(process.env.AWS_S3_PUBLIC_BASE_URL);
  if (envBase) {
    bases.add(envBase);
  }

  if (product?.bucketPublicBaseUrl) {
    const b = normalizePublicBaseUrl(product.bucketPublicBaseUrl);
    if (b) {
      bases.add(b);
    }
  }

  const bucket = product?.bucketName || getBucketName();
  const region = product?.bucketRegion || process.env.AWS_REGION?.trim();

  if (bucket && region) {
    if (!bucket.includes(".")) {
      bases.add(`https://${bucket}.s3.${region}.amazonaws.com`);
    }
    bases.add(
      `https://s3.${region}.amazonaws.com/${encodeURIComponent(bucket)}`
    );
  }

  return [...bases];
}

function keyFromBasePrefix(fullUrl, base) {
  const baseNorm = base.replace(/\/+$/, "");
  if (!fullUrl.startsWith(`${baseNorm}/`) && fullUrl !== baseNorm) {
    return null;
  }

  const rel = fullUrl.slice(baseNorm.length).replace(/^\//, "");
  if (!rel) {
    return null;
  }

  return rel.split("/").map((s) => decodeURIComponent(s)).join("/");
}

/**
 * If the URL is our proxy URL, returns the underlying S3 object key.
 */
function keyFromProxyUrl(trimmed) {
  if (!trimmed.includes("/api/media/s3")) {
    return null;
  }

  try {
    const u = new URL(trimmed, "http://localhost");
    const pathOk =
      u.pathname === "/api/media/s3" || u.pathname.endsWith("/api/media/s3");
    if (!pathOk) {
      return null;
    }

    const raw = u.searchParams.get("key");
    if (!raw) {
      return null;
    }

    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

export function extractS3KeyFromUrl(imageUrl, product) {
  if (!imageUrl || typeof imageUrl !== "string") {
    return null;
  }

  const trimmed = imageUrl.trim();

  if (trimmed.startsWith("/uploads/") || trimmed.startsWith("/upload/")) {
    return null;
  }

  const fromProxy = keyFromProxyUrl(trimmed);
  if (fromProxy) {
    return fromProxy;
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const href = url.href.split("#")[0];
  const bucket = product?.bucketName || getBucketName();
  const region = product?.bucketRegion || process.env.AWS_REGION?.trim();

  for (const base of collectPublicBasePrefixes(product)) {
    const key = keyFromBasePrefix(href, base);
    if (key) {
      return key;
    }
  }

  if (bucket && region) {
    const host = url.hostname;
    const pathStylePrefix = `https://s3.${region}.amazonaws.com/${encodeURIComponent(
      bucket
    )}`;
    const k = keyFromBasePrefix(href, pathStylePrefix);
    if (k) {
      return k;
    }

    const isVirtualHosted =
      host === `${bucket}.s3.amazonaws.com` ||
      (host.startsWith(`${bucket}.s3.`) && host.endsWith(".amazonaws.com"));

    if (isVirtualHosted) {
      const rawPath = url.pathname.replace(/^\//, "");
      if (!rawPath) {
        return null;
      }
      return rawPath.split("/").map((s) => decodeURIComponent(s)).join("/");
    }
  }

  return null;
}

export function rewriteImageUrlToProxy(imageUrl, product) {
  if (!isImageProxyEnabled()) {
    return imageUrl;
  }

  const key = extractS3KeyFromUrl(imageUrl, product);
  if (!key || !isValidObjectKey(key)) {
    return imageUrl;
  }

  return `/api/media/s3?key=${encodeURIComponent(key)}`;
}

function mapImageUrlForApi(imageUrl, product) {
  if (isImageProxyEnabled()) {
    return rewriteImageUrlToProxy(imageUrl, product);
  }

  const key = extractS3KeyFromUrl(imageUrl, product);
  if (key && isValidObjectKey(key)) {
    const publicUrl = buildPublicUrlForObjectKey(key);
    if (publicUrl) {
      return publicUrl;
    }
  }

  return imageUrl;
}

export function mapProductImagesForApi(product) {
  if (!product) {
    return product;
  }

  return {
    ...product,
    images: (product.images || []).map((u) => mapImageUrlForApi(u, product)),
  };
}

export function mapProductListResponseForApi(data) {
  if (!data?.products) {
    return data;
  }

  return {
    ...data,
    products: data.products.map(mapProductImagesForApi),
  };
}

export function mapOrderImagesForApi(order) {
  if (!order) {
    return order;
  }

  if (!Array.isArray(order.orderItems)) {
    return order;
  }

  return {
    ...order,
    orderItems: order.orderItems.map((item) => ({
      ...item,
      images: (item.images || []).map((u) => mapImageUrlForApi(u, null)),
    })),
  };
}

export function canonicalizeImageUrlForStorage(url) {
  if (typeof url !== "string") {
    return url;
  }

  const trimmed = url.trim();
  const fromProxy = keyFromProxyUrl(trimmed);
  if (fromProxy && isValidObjectKey(fromProxy)) {
    const canonical = buildPublicUrlForObjectKey(fromProxy);
    return canonical || trimmed;
  }

  try {
    const u = new URL(trimmed);
    const pathOk =
      u.pathname === "/api/media/s3" || u.pathname.endsWith("/api/media/s3");
    if (pathOk) {
      const raw = u.searchParams.get("key");
      if (raw) {
        const key = decodeURIComponent(raw);
        if (isValidObjectKey(key)) {
          const canonical = buildPublicUrlForObjectKey(key);
          return canonical || trimmed;
        }
      }
    }
  } catch {
    /* ignore */
  }

  return trimmed;
}

export function canonicalizeImageUrlsForStorage(urls) {
  if (!Array.isArray(urls)) {
    return urls;
  }

  return urls.map((u) => canonicalizeImageUrlForStorage(u));
}
