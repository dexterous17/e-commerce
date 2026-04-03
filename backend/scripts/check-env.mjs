import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

if (hasJwt) {
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
