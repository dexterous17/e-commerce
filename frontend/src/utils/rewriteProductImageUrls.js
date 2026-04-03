/**
 * Rewrites direct S3 object URLs to the backend proxy path so <img> works with private buckets.
 * Used when rehydrating cart from localStorage (URLs were saved before the API proxy was on).
 */
export function rewriteDirectS3ImageUrlToProxy(url) {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    return url;
  }
  try {
    const u = new URL(url);
    if (!u.hostname.includes("amazonaws.com")) {
      return url;
    }
    const path = u.pathname.replace(/^\//, "");
    if (!path || path.includes("..")) {
      return url;
    }
    const key = path.split("/").map((s) => decodeURIComponent(s)).join("/");
    if (!key.startsWith("products/")) {
      return url;
    }
    return `/api/media/s3?key=${encodeURIComponent(key)}`;
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
