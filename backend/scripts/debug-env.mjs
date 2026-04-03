import fs from "fs";
import path from "path";

import dotenv from "dotenv";

import {
  preferredBackendEnvPath,
  resolvedBackendEnvPath,
} from "../config/repoEnvPaths.js";

const envPath = resolvedBackendEnvPath ?? preferredBackendEnvPath;
const cwdEnv = path.resolve(process.cwd(), ".env");

console.log("process.cwd():", process.cwd());
console.log(
  "Resolved backend .env (env/backend or legacy backend/.env):",
  resolvedBackendEnvPath ?? "(none)",
  resolvedBackendEnvPath ? "exists: true" : ""
);
console.log("Preferred backend path:", preferredBackendEnvPath);
console.log("Cwd .env:", cwdEnv, "exists:", fs.existsSync(cwdEnv));

if (envPath && fs.existsSync(envPath)) {
  const st = fs.statSync(envPath);
  console.log("Active backend env file size (bytes):", st.size);
  const raw = fs.readFileSync(envPath, "utf8");
  const nonCommentLines = raw.split("\n").filter((l) => {
    const t = l.trim();
    return t && !t.startsWith("#");
  });
  console.log("Non-empty, non-comment lines:", nonCommentLines.length);
  const hasJwtLine = /^\s*JWT_SECRET\s*=/m.test(raw);
  console.log("Contains JWT_SECRET= line:", hasJwtLine);
  const r = dotenv.config({ path: envPath, quiet: true });
  console.log(
    "dotenv parsed key count:",
    r.parsed ? Object.keys(r.parsed).length : 0
  );
  if (r.error) console.log("dotenv error:", r.error.code, r.error.message);
}
