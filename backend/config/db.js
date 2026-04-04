import colors from "colors";
import pg from "pg";

import "./loadEnv.js";
import schemaStatements from "../db/schema.js";
import { dbgDb } from "../utils/debugLog.js";

const { Pool } = pg;

let pool;

function getEnv(...names) {
  for (const name of names) {
    const value = process.env[name];

    if (value !== undefined && value !== "") {
      return value;
    }
  }

  return undefined;
}

/** Resolves Postgres connection string from DATABASE_URL / PG_* / POSTGRES_*. */
export function resolveDatabaseConnectionString() {
  const direct = getEnv("DATABASE_URL", "PG_CONNECTION_STRING");
  if (direct) {
    const trimmed = direct.trim();
    const lower = trimmed.toLowerCase();
    if (
      lower.startsWith("sqlite:") ||
      lower.startsWith("file:") ||
      (lower.includes(".sqlite") && !lower.includes("://"))
    ) {
      throw new Error(
        "This app uses PostgreSQL only. DATABASE_URL must start with postgresql:// or postgres:// (not SQLite). See backend/db/.env.example."
      );
    }
    if (!/^postgres(ql)?:\/\//i.test(trimmed)) {
      throw new Error(
        "DATABASE_URL must be a PostgreSQL URL (postgresql://... or postgres://...)."
      );
    }
    if (trimmed.toLowerCase().startsWith("postgres://")) {
      return `postgresql://${trimmed.slice("postgres://".length)}`;
    }
    return trimmed;
  }

  const host = getEnv("PGHOST", "POSTGRES_HOST");
  const port = getEnv("PGPORT", "POSTGRES_PORT") || "5432";
  const user = getEnv("PGUSER", "POSTGRES_USER");
  const password = getEnv("PGPASSWORD", "POSTGRES_PASSWORD") ?? "";
  const database = getEnv("PGDATABASE", "POSTGRES_DB");

  if (host && user && database) {
    const u = encodeURIComponent(user);
    const p = encodeURIComponent(password);
    return `postgresql://${u}:${p}@${host}:${port}/${database}`;
  }

  return null;
}

function maskConnectionString(connectionString) {
  if (!connectionString) {
    return null;
  }
  return connectionString.replace(/:[^:@/]+@/, ":****@");
}

function getPool() {
  if (!pool) {
    const connectionString = resolveDatabaseConnectionString();
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set (or PGHOST, PGUSER, PGDATABASE / POSTGRES_*). See backend/db/.env.example."
      );
    }

    pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
    });
  }

  return pool;
}

export function query(text, params = [], runner) {
  const executor = runner || getPool();
  return executor.query(text, params).then((res) => ({
    rows: res.rows,
    rowCount: res.rowCount ?? 0,
  }));
}

export async function withTransaction(callback) {
  const client = await getPool().connect();

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

let initializationPromise;

export async function initializeDatabase() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const p = getPool();
      for (const sql of schemaStatements) {
        const trimmed = sql.trim();
        if (trimmed) {
          await p.query(trimmed);
        }
      }

      const masked = maskConnectionString(resolveDatabaseConnectionString());
      console.log(`PostgreSQL ready: ${masked || "(connected)"}`.underline.cyan);
      dbgDb("ready database=%s", masked || "");
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
    console.error(
      `Check DATABASE_URL or PG* / POSTGRES_* variables in backend/db/.env (see backend/db/.env.example).`
        .yellow
    );
    process.exit(1);
  }
};

export default connectDB;
