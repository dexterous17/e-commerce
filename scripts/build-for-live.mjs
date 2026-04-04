/**
 * Production-oriented build:
 * - Frontend: Vite build (VITE_API_ORIGIN in env/frontend/.env.production; empty = same-origin /api).
 *   (seeds env/frontend/.env.production from .env.production.example when missing).
 * - Backend: npm ci --omit=dev
 * - When env/database/.env.production and env/aws/.env.production exist, merges them
 *   (plus optional env/backend/.env.production) into build/deploy/.env for server/Compose.
 *
 * Usage: node scripts/build-for-live.mjs [--strict]
 *   --strict  Exit non-zero if live database/aws production env files are missing.
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const strict = process.argv.includes("--strict");

const prodDatabase = path.join(repoRoot, "env", "database", ".env.production");
const prodAws = path.join(repoRoot, "env", "aws", ".env.production");
const prodBackend = path.join(repoRoot, "env", "backend", ".env.production");

if (strict) {
  const hasDb = fs.existsSync(prodDatabase);
  const hasAws = fs.existsSync(prodAws);
  if (!hasDb || !hasAws) {
    console.error(
      "[build-for-live] --strict requires env/database/.env.production and env/aws/.env.production.\n" +
        "Copy from env/database/.env.production.example and env/aws/.env.production.example"
    );
    process.exit(1);
  }
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function copyIfMissing(src, dest) {
  if (exists(dest)) {
    return;
  }
  if (!exists(src)) {
    console.error(`[build-for-live] Missing template: ${path.relative(repoRoot, src)}`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(
    `[build-for-live] Created ${path.relative(repoRoot, dest)} (from ${path.basename(src)})`
  );
}

function runNpm(args, cwd, extraEnv = {}) {
  const isWin = process.platform === "win32";
  const cmd = isWin ? "npm.cmd" : "npm";
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
    shell: false,
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0 && result.status !== null) {
    process.exit(result.status);
  }
}

const frontendExample = path.join(repoRoot, "env", "frontend", ".env.production.example");
const frontendProd = path.join(repoRoot, "env", "frontend", ".env.production");

copyIfMissing(frontendExample, frontendProd);

// Ensure VITE_API_ORIGIN key exists (empty = same-origin /api via host nginx).
if (exists(frontendProd)) {
  const raw = fs.readFileSync(frontendProd, "utf8");
  const hasOrigin = /^\s*VITE_API_ORIGIN\s*=/m.test(raw);
  if (!hasOrigin) {
    const block =
      `\n# Added by scripts/build-for-live.mjs (same-origin API)\nVITE_API_ORIGIN=\n`;
    fs.appendFileSync(frontendProd, block);
    console.log(
      `[build-for-live] Appended VITE_API_ORIGIN= to ${path.relative(repoRoot, frontendProd)}`
    );
  }
}

console.log("[build-for-live] Frontend: VITE_API_ORIGIN from env/frontend/.env.production (empty => same-origin /api)");
runNpm(["run", "build", "--prefix", "frontend"], repoRoot, { NODE_ENV: "production" });

runNpm(["ci", "--omit=dev"], path.join(repoRoot, "backend"));

const hasDb = exists(prodDatabase);
const hasAws = exists(prodAws);

if (hasDb && hasAws) {
  const outDir = path.join(repoRoot, "build", "deploy");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, ".env");
  const pieces = [prodDatabase, prodAws];
  if (exists(prodBackend)) {
    pieces.push(prodBackend);
  }
  const banner =
    "# Merged by scripts/build-for-live.mjs from env/*/.env.production (gitignored).\n" +
    "# Order: database → aws → backend. Later duplicate keys should win when parsed.\n\n";
  let body = "";
  for (const p of pieces) {
    const label = path.relative(repoRoot, p);
    body += `\n# --- ${label} ---\n`;
    body += fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
    if (!body.endsWith("\n")) {
      body += "\n";
    }
  }
  fs.writeFileSync(outFile, banner + body, "utf8");
  console.log(`[build-for-live] Wrote ${path.relative(repoRoot, outFile)}`);
} else {
  console.warn(
    "[build-for-live] Skipping build/deploy/.env — add env/database/.env.production and env/aws/.env.production " +
      "(see *.env.production.example in those folders) to emit a merged file for deploy."
  );
}

console.log(
  "[build-for-live] Done: frontend/dist, backend deps (omit=dev)" +
    (hasDb && hasAws ? ", build/deploy/.env" : "")
);
