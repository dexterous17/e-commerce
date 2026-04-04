/**
 * When the SPA is served on a different host than the API, Vite sets VITE_API_ORIGIN
 * (see vite.config.js). Axios uses it as baseURL; image URLs under /api and /uploads
 * are prefixed so <img> requests hit the API host.
 */
export function getApiOrigin() {
  const raw = import.meta.env.VITE_API_ORIGIN;
  if (raw == null || typeof raw !== "string") return "";
  return raw.trim().replace(/\/$/, "");
}

export function resolvePublicApiUrl(url) {
  if (typeof url !== "string" || !url.trim()) return url;
  const t = url.trim();
  if (/^https?:\/\//i.test(t)) return url;
  if (!t.startsWith("/")) return url;
  const base = getApiOrigin();
  if (!base) return t;
  if (
    t.startsWith("/api/") ||
    t === "/api" ||
    t.startsWith("/uploads/") ||
    t === "/uploads"
  ) {
    return `${base}${t}`;
  }
  return t;
}
