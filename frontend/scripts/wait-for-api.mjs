import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadEnv } from "vite";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = loadEnv("development", frontendRoot, "");
const raw = (
  env.DEV_PROXY_TARGET ||
  env.VITE_DEV_PROXY_TARGET ||
  "http://localhost:5002"
).trim();

let healthUrl;
try {
  healthUrl = new URL("/api/health", raw);
} catch {
  console.error(`Invalid DEV_PROXY_TARGET / VITE_DEV_PROXY_TARGET: ${raw}`);
  process.exit(1);
}

const timeoutMs = Number.parseInt(process.env.WAIT_FOR_API_MS || "180000", 10);
const intervalMs = 400;

process.stderr.write(`[wait-for-api] Waiting for ${healthUrl.href} …\n`);

const deadline = Date.now() + timeoutMs;

for (;;) {
  try {
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      process.stderr.write("[wait-for-api] API ready.\n");
      process.exit(0);
    }
  } catch {
    /* ECONNREFUSED, timeouts, etc. */
  }
  if (Date.now() >= deadline) {
    console.error(
      `[wait-for-api] Timed out after ${timeoutMs}ms. Ensure the API is running (DATABASE_URL / Postgres for backend, PORT) and env/backend/.env PORT matches DEV_PROXY_TARGET in env/frontend/.env (${healthUrl.origin}).`
    );
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, intervalMs));
}
