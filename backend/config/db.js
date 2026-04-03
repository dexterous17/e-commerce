import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import colors from "colors";
import pg from "pg";

import "./loadEnv.js";
import schemaSql from "../db/schema.js";
import { dbgDb } from "../utils/debugLog.js";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

let pool;
let initializationPromise;

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function getEnv(...names) {
  for (const name of names) {
    const value = process.env[name];

    if (value !== undefined && value !== "") {
      return value;
    }
  }

  return undefined;
}

function resolveRepoPath(filePath) {
  if (!filePath) {
    return null;
  }

  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(repoRoot, filePath);
}

function getConnectionHost(connectionString, fallbackHost) {
  if (!connectionString) {
    return fallbackHost;
  }

  try {
    return new URL(connectionString).hostname;
  } catch {
    return fallbackHost;
  }
}

function getSslConfig(connectionHost) {
  const sslMode = String(
    getEnv("PGSSLMODE", "POSTGRES_SSL_MODE", "DATABASE_SSL_MODE") || ""
  ).toLowerCase();
  const explicitToggle = getEnv("PGSSL", "POSTGRES_SSL", "DATABASE_SSL");
  const explicitRejectUnauthorized = getEnv(
    "PGSSL_REJECT_UNAUTHORIZED",
    "POSTGRES_SSL_REJECT_UNAUTHORIZED",
    "DATABASE_SSL_REJECT_UNAUTHORIZED"
  );
  const inlineCertificate = getEnv("POSTGRES_SSL_CA", "DATABASE_SSL_CA");
  const explicitCertPath = getEnv(
    "PGSSLROOTCERT",
    "PGSSLROOTCERT_PATH",
    "POSTGRES_SSL_CA_PATH",
    "DATABASE_SSL_CA_PATH"
  );
  const sslRequested =
    (explicitToggle && explicitToggle.toLowerCase() === "true") ||
    Boolean(inlineCertificate) ||
    Boolean(explicitCertPath) ||
    ["require", "verify-ca", "verify-full", "prefer"].includes(sslMode);

  if (!sslRequested || sslMode === "disable") {
    return undefined;
  }

  let certificateAuthority;

  if (inlineCertificate) {
    certificateAuthority = inlineCertificate.includes("BEGIN CERTIFICATE")
      ? inlineCertificate.replace(/\\n/g, "\n")
      : fs.readFileSync(resolveRepoPath(inlineCertificate), "utf8");
  } else if (explicitCertPath) {
    certificateAuthority = fs.readFileSync(
      resolveRepoPath(explicitCertPath),
      "utf8"
    );
  }

  const rejectUnauthorized =
    explicitRejectUnauthorized === undefined
      ? Boolean(certificateAuthority)
      : explicitRejectUnauthorized.toLowerCase() !== "false";

  return {
    rejectUnauthorized,
    ...(certificateAuthority ? { ca: certificateAuthority } : {}),
  };
}

function createPool() {
  if (pool) {
    return pool;
  }

  const connectionString = getEnv("DATABASE_URL", "POSTGRES_URL", "POSTGRES_URI");
  const fallbackHost = getEnv("PGHOST", "POSTGRES_HOST");
  const connectionHost = getConnectionHost(connectionString, fallbackHost);
  const ssl = getSslConfig(connectionHost);
  const poolConfig = connectionString
    ? { connectionString }
    : {
        host: fallbackHost,
        port: Number.parseInt(getEnv("PGPORT", "POSTGRES_PORT") || "5432", 10),
        user: getEnv("PGUSER", "POSTGRES_USER"),
        password: getEnv("PGPASSWORD", "POSTGRES_PASSWORD"),
        database: getEnv("PGDATABASE", "POSTGRES_DB"),
      };

  if (
    !connectionString &&
    (!poolConfig.host || !poolConfig.user || !poolConfig.database)
  ) {
    throw new Error(
      "Missing Postgres connection settings. Set DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE."
    );
  }

  if (ssl) {
    poolConfig.ssl = ssl;
  }

  pool = new Pool(poolConfig);
  pool.on("error", (error) => {
    console.error(`Postgres pool error: ${error.message}`.red.bold);
  });

  return pool;
}

export function getPool() {
  return createPool();
}

export function query(text, params = [], runner) {
  const executor = runner || createPool();
  return executor.query(text, params);
}

export async function withTransaction(callback) {
  const client = await createPool().connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function initializeDatabase() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const client = await createPool().connect();

      try {
        await client.query("SELECT 1");
        await client.query(schemaSql);

        const statusResult = await client.query(
          "SELECT current_database() AS database_name, current_user AS user_name"
        );
        const { database_name, user_name } = statusResult.rows[0];

        console.log(
          `Postgres connected: ${database_name} as ${user_name}`.underline.cyan
        );
        dbgDb("ready database=%s user=%s", database_name, user_name);
      } finally {
        client.release();
      }
    })().catch((error) => {
      initializationPromise = undefined;
      throw error;
    });
  }

  return initializationPromise;
}

const connectDB = async () => {
  try {
    await initializeDatabase();
  } catch (error) {
    console.error(`Error: ${error.message}`.red.underline.bold);
    if (error.code === "ECONNREFUSED") {
      const host = getEnv("PGHOST", "POSTGRES_HOST") || "127.0.0.1";
      const port = getEnv("PGPORT", "POSTGRES_PORT") || "5432";
      console.error(
        `Postgres refused TCP connection at ${host}:${port}. Start the database (e.g. \`docker compose up -d postgres\` from the repo root) or fix PGHOST/PGPORT/PGUSER/PGPASSWORD in env/database/.env.`
          .yellow
      );
    }
    process.exit(1);
  }
};

export default connectDB;
