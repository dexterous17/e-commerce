import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import dotenv from "dotenv";

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const repoRoot = path.resolve(backendRoot, "..");
const databaseEnvPath = path.join(repoRoot, "database", ".env");
const awsEnvPath = path.join(repoRoot, "aws", ".env");

// Optional shared DB credentials (DATABASE_URL, PG*). backend/.env overrides.
dotenv.config({ path: databaseEnvPath, quiet: true });

// Optional repo-root AWS credentials and bucket settings (same keys as backend/.env).
dotenv.config({ path: awsEnvPath, quiet: true });

const envPath = path.join(backendRoot, ".env");
const dotenvResult = dotenv.config({ path: envPath, quiet: true });

if (dotenvResult.error?.code === "ENOENT") {
  console.warn(
    `[env] Missing file: ${envPath}\n` +
      "      Create it from the backend folder:  cp .env.example .env\n" +
      "      Or from the repo root:               cp backend/.env.example backend/.env\n" +
      "      Postgres settings may live in database/.env (repo root); you still need backend/.env for JWT_SECRET and server options. " +
      "You can run:  npm run env:init"
  );
} else if (
  fs.existsSync(envPath) &&
  (!dotenvResult.parsed || Object.keys(dotenvResult.parsed).length === 0)
) {
  console.warn(
    `[env] No variables were loaded from ${envPath} (file may be empty). ` +
      "Copy lines from .env.example or run: npm run env:init"
  );
}

/**
 * Dotenv does not override existing keys. Shells, IDEs, and Docker Compose often inject
 * AWS_* as empty strings, which blocks backend/.env and disables the S3 image proxy
 * (API then returns direct S3 URLs → 403 for private buckets).
 *
 * When backend/.env exists, non-empty values for these keys always win so local config
 * stays authoritative. In Docker the file is usually absent (.dockerignore); use
 * compose defaults or env_file for region/bucket there.
 */
export const AWS_S3_ENV_KEYS_FROM_BACKEND_FILE = [
  "AWS_REGION",
  "AWS_S3_BUCKET_NAME",
  "AWS_BUCKET_NAME",
  "AWS_S3_PUBLIC_BASE_URL",
  "AWS_S3_PREFIX",
  "AWS_S3_IMAGE_PROXY",
];

let backendEnvFileLastMtimeMs = null;

/**
 * Re-applies S3-related vars from backend/.env when the file is new or changed (mtime).
 * Cheap when unchanged (one stat). Also invoked from isImageProxyEnabled() so a long-lived
 * process still picks up correct values if startup env was wrong.
 *
 * @param {{ force?: boolean }} [options]  If force is true, re-read the file even when mtime
 *   matches (e.g. process.env was cleared after the last sync).
 */
export function syncAwsS3EnvFromBackendFile(options = {}) {
  const force = Boolean(options.force);

  if (!fs.existsSync(envPath)) {
    backendEnvFileLastMtimeMs = null;
    return;
  }

  let mtimeMs;
  try {
    mtimeMs = fs.statSync(envPath).mtimeMs;
  } catch {
    return;
  }

  if (!force && backendEnvFileLastMtimeMs === mtimeMs) {
    return;
  }

  let parsed;
  try {
    parsed = dotenv.parse(fs.readFileSync(envPath, "utf8"));
  } catch {
    return;
  }

  backendEnvFileLastMtimeMs = mtimeMs;

  for (const key of AWS_S3_ENV_KEYS_FROM_BACKEND_FILE) {
    const fromFile = parsed[key];
    if (fromFile !== undefined && String(fromFile).trim() !== "") {
      process.env[key] = fromFile;
    }
  }
}

syncAwsS3EnvFromBackendFile();

/** Only these env vars may be populated via a sibling `NAME_FILE` path (Docker/k8s secrets). */
const ALLOWED_SECRET_FILE_TARGETS = new Set([
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "DATABASE_URL",
  "JWT_SECRET",
  "PAYPAL_CLIENT_ID",
  "PGDATABASE",
  "PGHOST",
  "PGPASSWORD",
  "PGPORT",
  "PGUSER",
  "POSTGRES_URI",
  "POSTGRES_URL",
]);

for (const [name, filePath] of Object.entries(process.env)) {
  if (!name.endsWith("_FILE") || !filePath) {
    continue;
  }

  const targetName = name.slice(0, -5);

  if (!ALLOWED_SECRET_FILE_TARGETS.has(targetName)) {
    continue;
  }

  if (process.env[targetName]) {
    continue;
  }

  try {
    process.env[targetName] = fs.readFileSync(filePath, "utf8").trim();
  } catch (error) {
    throw new Error(
      `Unable to read secret file for ${targetName} at ${filePath}: ${error.message}`
    );
  }
}
