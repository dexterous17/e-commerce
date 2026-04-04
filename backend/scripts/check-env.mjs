import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import colors from "colors";

import "../config/loadEnv.js";
import { resolveDatabaseConnectionString } from "../config/db.js";
import {
  preferredBackendEnvPath,
  resolvedBackendEnvPath,
} from "../config/repoEnvPaths.js";

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const envPath = resolvedBackendEnvPath ?? preferredBackendEnvPath;

const hasJwt =
  Boolean(process.env.JWT_SECRET?.trim()) ||
  Boolean(process.env.JWT_SECRET_FILE?.trim());

function maskDbUrl(url) {
  if (!url) return "(none)";
  return url.replace(/:[^:@/]+@/, ":****@");
}

function failPostgres(message) {
  console.error(`
  Cannot start: ${message}

  Fix:
    Ensure DATABASE_URL in backend/db/.env or env/database/.env uses PostgreSQL, e.g.:
      DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/ecommerce
    See backend/db/.env.example
`);
  process.exit(1);
}

function failS3(message) {
  console.error(`
  Cannot start: ${message}

  Fix:
    Set AWS_REGION and AWS_S3_BUCKET_NAME (or AWS_BUCKET_NAME) in env/aws/.env
    Copy from env/aws/.env.example (repository root).
`);
  process.exit(1);
}

if (hasJwt) {
  let dbUrl;
  try {
    dbUrl = resolveDatabaseConnectionString();
  } catch (e) {
    failPostgres(e.message);
  }
  if (!dbUrl) {
    failPostgres("DATABASE_URL is not set (and PGHOST/PGUSER/PGDATABASE are incomplete).");
  }

  const region = process.env.AWS_REGION?.trim();
  const bucket =
    process.env.AWS_S3_BUCKET_NAME?.trim() ||
    process.env.AWS_BUCKET_NAME?.trim();
  if (!region || !bucket) {
    failS3(
      "AWS S3 is required: set AWS_REGION and AWS_S3_BUCKET_NAME (or AWS_BUCKET_NAME)."
    );
  }

  if (process.env.NODE_ENV === "development") {
    console.log(
      `[env] PostgreSQL ${maskDbUrl(dbUrl)} | S3 bucket ${bucket} (${region})`.gray
    );
  }

  process.exit(0);
}

if (!fs.existsSync(envPath)) {
  console.error(`
  Cannot start: JWT_SECRET is not set, and there is no env file at:
    ${envPath}

  Fix:
    cd ${path.relative(process.cwd(), backendRoot) || "backend"} && npm run env:init
    Then edit env/backend/.env and set JWT_SECRET (generate one: openssl rand -base64 48)

  Or manually:
    cp env/backend/.env.example env/backend/.env
    (from the repository root)
`);
  process.exit(1);
}

if (fs.statSync(envPath).size === 0) {
  console.error(`
  Cannot start: ${envPath} is empty.
  Copy variables from env/backend/.env.example or run: npm run env:init
  (Remove this empty .env first if env:init skipped creating it.)
`);
  process.exit(1);
}
