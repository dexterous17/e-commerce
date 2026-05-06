import { resolvePublicApiUrl } from "../lib/apiBase";

/**
 * Rewrites direct S3 object URLs to the backend proxy path so <img> works with private buckets.
 * Used when rehydrating cart from localStorage (URLs were saved before the API proxy was on).
 */
export function rewriteDirectS3ImageUrlToProxy(url) {
  if (typeof url !== "string") {
    return url;
  }
  const trimmed = url.trim();
  if (
    trimmed.startsWith("/api/media/s3") ||
    trimmed.includes("/api/media/s3?")
  ) {
    return resolvePublicApiUrl(trimmed);
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return url;
  }
  try {
    const u = new URL(trimmed);
    if (!u.hostname.includes("amazonaws.com")) {
      return url;
    }
    const rawPath = u.pathname.replace(/^\//, "");
    if (!rawPath || rawPath.includes("..")) {
      return url;
    }
    const segments = rawPath
      .split("/")
      .filter(Boolean)
      .map((s) => decodeURIComponent(s));

    if (segments.length === 0) {
      return url;
    }

    /** Virtual-hosted: /products/...  Path-style: /bucket/products/... */
    let key;
    if (segments[0] === "products") {
      key = segments.join("/");
    } else if (segments.length >= 2 && segments[1] === "products") {
      key = segments.slice(1).join("/");
    } else {
      return url;
    }

    if (!key.startsWith("products/")) {
      return url;
    }
    return resolvePublicApiUrl(
      `/api/media/s3?key=${encodeURIComponent(key)}`
    );
  } catch {
    return url;
  }
}

export function rewriteCartItemImages(cartItems) {
  if (!Array.isArray(cartItems)) {
    return [];
  }
  return cartItems.map((item) => {
    if (!item?.images?.length) {
      return item;
    }
    return {
      ...item,
      images: item.images.map((u) => rewriteDirectS3ImageUrlToProxy(u)),
    };
  });
}
