import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
export const repoRoot = path.resolve(backendRoot, "..");

/** First path in the list that exists on disk, or null. */
export function firstExistingPath(candidates) {
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

export const preferredBackendEnvPath = path.join(
  repoRoot,
  "env",
  "backend",
  ".env"
);
export const preferredDatabaseEnvPath = path.join(
  repoRoot,
  "env",
  "database",
  ".env"
);
/** SQLite / DB path vars — canonical location under backend/db */
export const preferredBackendDbEnvPath = path.join(backendRoot, "db", ".env");
export const preferredAwsEnvPath = path.join(repoRoot, "env", "aws", ".env");

export const resolvedDatabaseEnvPath = firstExistingPath([
  preferredBackendDbEnvPath,
  preferredDatabaseEnvPath,
  path.join(repoRoot, "database", ".env"),
]);

export const resolvedAwsEnvPath = firstExistingPath([
  preferredAwsEnvPath,
  path.join(repoRoot, "aws", ".env"),
]);

export const resolvedBackendEnvPath = firstExistingPath([
  preferredBackendEnvPath,
  path.join(backendRoot, ".env"),
]);
