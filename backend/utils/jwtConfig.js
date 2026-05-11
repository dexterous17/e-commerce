/**
 * Read JWT settings from the environment.
 * Import `../config/loadEnv.js` (or ensure dotenv ran) before using in apps/scripts.
 */

/**
 * @returns {{
 *   secretKey: string;
 *   algorithm: string;
 *   expiresIn: string;
 * }}
 */
export function getJwtSettings() {
  const secretKey = (
    process.env.JWT_SECRET ||
    process.env.JWT_SECRET_KEY ||
    ""
  ).trim();

  if (!secretKey) {
    throw new Error("JWT_SECRET is not set (optional alias: JWT_SECRET_KEY)");
  }

  const algorithm = (process.env.JWT_ALGORITHM || "HS256").trim();
  const expiresIn = (process.env.JWT_EXPIRES_IN || "30d").trim();

  return Object.freeze({
    secretKey,
    algorithm,
    expiresIn,
  });
}
