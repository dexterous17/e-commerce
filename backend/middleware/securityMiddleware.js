import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

const isProd = process.env.NODE_ENV === "production";

/**
 * Trust proxy when behind nginx, ALB, Cloudflare, etc. (needed for accurate rate-limit IPs).
 */
export function applyTrustProxy(app) {
  const trust =
    process.env.TRUST_PROXY === "true" || process.env.TRUST_PROXY === "1";

  if (trust) {
    const hops = Number.parseInt(process.env.TRUST_PROXY_HOPS || "1", 10);
    app.set("trust proxy", Number.isFinite(hops) && hops > 0 ? hops : 1);
  }
}

export function applyHelmet(app) {
  if (isProd) {
    app.use(
      helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
      })
    );
  }
}

export function applyCors(app) {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (raw) {
    const origins = raw.split(",").map((s) => s.trim()).filter(Boolean);
    app.use(
      cors({
        origin: origins.length === 1 ? origins[0] : origins,
        credentials: true,
      })
    );
    return;
  }

  if (!isProd) {
    app.use(cors({ credentials: true }));
    return;
  }

  // Production without CORS_ORIGIN: reflect request Origin (split-domain API + storefront).
  app.use(cors({ origin: true, credentials: true }));
}

const windowMs = Number.parseInt(
  process.env.RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`,
  10
);
const maxGeneral = Number.parseInt(
  process.env.RATE_LIMIT_MAX || (isProd ? "400" : "2000"),
  10
);

function isPublicMediaGet(req) {
  if (req.method !== "GET") {
    return false;
  }
  const p = String(req.originalUrl || req.url || "").split("?")[0];
  return p.startsWith("/api/media");
}

/** Skips S3/image proxy traffic so product grids do not hit 429 under normal browsing. */
export const apiGeneralRateLimit = rateLimit({
  windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 15 * 60 * 1000,
  max: Number.isFinite(maxGeneral) && maxGeneral > 0 ? maxGeneral : 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later" },
  skip: (req) => isPublicMediaGet(req),
});

const authWindow = Number.parseInt(
  process.env.AUTH_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`,
  10
);
const authMax = Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX || "40", 10);

/** Failed login attempts (successful logins are not counted). */
export const authLoginRateLimit = rateLimit({
  windowMs:
    Number.isFinite(authWindow) && authWindow > 0 ? authWindow : 15 * 60 * 1000,
  max: Number.isFinite(authMax) && authMax > 0 ? authMax : 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again later" },
  skipSuccessfulRequests: true,
});

const regMax = Number.parseInt(
  process.env.REGISTER_RATE_LIMIT_MAX || "25",
  10
);

/** All registration attempts (including successful) to reduce spam signups. */
export const authRegisterRateLimit = rateLimit({
  windowMs:
    Number.isFinite(authWindow) && authWindow > 0 ? authWindow : 15 * 60 * 1000,
  max: Number.isFinite(regMax) && regMax > 0 ? regMax : 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many registration attempts, please try again later" },
});

export function applyRateLimits(app) {
  app.use("/api/", apiGeneralRateLimit);
}
