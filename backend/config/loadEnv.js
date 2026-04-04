import fs from "fs";
import path from "path";

import dotenv from "dotenv";

import {
  backendRoot,
  preferredBackendEnvPath,
  resolvedAwsEnvPath,
  resolvedBackendEnvPath,
  resolvedDatabaseEnvPath,
} from "./repoEnvPaths.js";

// Load order: backend/db → env/database (legacy) → aws → backend (later overrides earlier).
if (resolvedDatabaseEnvPath) {
  dotenv.config({ path: resolvedDatabaseEnvPath, quiet: true });
}

if (resolvedAwsEnvPath) {
  dotenv.config({ path: resolvedAwsEnvPath, quiet: true });
}

const envPath = resolvedBackendEnvPath;
const dotenvResult = envPath
  ? dotenv.config({ path: envPath, quiet: true })
  : { error: { code: "ENOENT" } };

if (dotenvResult.error?.code === "ENOENT") {
  console.warn(
    `[env] Missing backend env file. Expected one of:\n` +
      `      ${preferredBackendEnvPath}\n` +
      `      ${path.join(backendRoot, ".env")} (legacy)\n` +
      "      Create from template:  cp env/backend/.env.example env/backend/.env\n" +
      "      Or from backend/:       npm run env:init\n" +
      "      Database URL: backend/db/.env or env/database/.env. AWS keys: env/aws/.env (or aws/.env)."
  );
} else if (
  envPath &&
  fs.existsSync(envPath) &&
  (!dotenvResult.parsed || Object.keys(dotenvResult.parsed).length === 0)
) {
  console.warn(
    `[env] No variables were loaded from ${envPath} (file may be empty). ` +
      "Copy lines from env/backend/.env.example or run: npm run env:init"
  );
}

/**
 * Dotenv does not override existing keys. Shells, IDEs, and Docker Compose often inject
 * AWS_* as empty strings, which blocks env files and disables the S3 image proxy
 * (API then returns direct S3 URLs → 403 for private buckets).
 *
 * Non-empty values from env/aws/.env and env/backend/.env (merged; backend wins on overlap)
 * always win so local config stays authoritative. In Docker the files may be absent
 * (.dockerignore); use compose defaults or env_file for region/bucket there.
 */
export const AWS_S3_ENV_KEYS_FROM_BACKEND_FILE = [
  "AWS_REGION",
  "AWS_S3_BUCKET_NAME",
  "AWS_BUCKET_NAME",
  "AWS_S3_PUBLIC_BASE_URL",
  "AWS_S3_PREFIX",
  "AWS_S3_IMAGE_PROXY",
];

let s3EnvSourcesLastSignature = null;

function parseDotEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {};
  }
  try {
    return dotenv.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

/**
 * Re-applies S3-related vars from env/aws/.env and env/backend/.env when either file is new or changed (mtime).
 * Cheap when unchanged (stat per path). Also invoked from isImageProxyEnabled() so a long-lived
 * process still picks up correct values if startup env was wrong.
 *
 * @param {{ force?: boolean }} [options]  If force is true, re-read the files even when mtime
 *   matches (e.g. process.env was cleared after the last sync).
 */
export function syncAwsS3EnvFromBackendFile(options = {}) {
  const force = Boolean(options.force);

  const paths = [resolvedAwsEnvPath, resolvedBackendEnvPath].filter(Boolean);
  if (paths.length === 0) {
    s3EnvSourcesLastSignature = null;
    return;
  }

  let signature = "";
  for (const p of paths) {
    try {
      signature += `${p}:${fs.statSync(p).mtimeMs};`;
    } catch {
      signature += `${p}:missing;`;
    }
  }

  if (!force && s3EnvSourcesLastSignature === signature) {
    return;
  }

  s3EnvSourcesLastSignature = signature;

  let merged = {};
  for (const p of paths) {
    merged = { ...merged, ...parseDotEnvFile(p) };
  }

  for (const key of AWS_S3_ENV_KEYS_FROM_BACKEND_FILE) {
    const fromFile = merged[key];
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
  "JWT_SECRET",
  "PAYPAL_CLIENT_ID",
  "DATABASE_URL",
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
