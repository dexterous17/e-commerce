import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const repoRoot = path.resolve(backendRoot, "..");

const systems = [
  { dir: path.join(repoRoot, "env", "backend"), label: "backend API" },
  { dir: path.join(backendRoot, "db"), label: "SQLite (backend/db)" },
  { dir: path.join(repoRoot, "env", "aws"), label: "AWS / S3" },
  { dir: path.join(repoRoot, "env", "frontend"), label: "Vite frontend" },
];

let created = 0;

for (const { dir, label } of systems) {
  const envPath = path.join(dir, ".env");
  const examplePath = path.join(dir, ".env.example");

  if (fs.existsSync(envPath)) {
    console.log(`[${label}] already exists (not overwriting): ${envPath}`);
    continue;
  }

  if (!fs.existsSync(examplePath)) {
    console.warn(`[${label}] skip — missing template: ${examplePath}`);
    continue;
  }

  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(examplePath, envPath);
  console.log(`[${label}] created ${envPath} from .env.example`);
  created += 1;
}

if (created === 0) {
  console.log("No new env files created (all present or templates missing).");
} else {
  console.log(
    "\nEdit JWT_SECRET, SQLITE_DATABASE_PATH if needed, AWS keys, and PayPal IDs before production."
  );
}

console.log(
  "\nDocker Compose still reads repo-root `.env` for port/db name substitution; template: env/docker/.env.example → cp env/docker/.env.example .env"
);
