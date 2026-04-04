import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import colors from "colors";
import { DatabaseSync } from "node:sqlite";

import "./loadEnv.js";
import schemaSql from "../db/schema.js";
import { dbgDb } from "../utils/debugLog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");

let dbInstance;
let initializationPromise;
let serializedChain = Promise.resolve();

function getEnv(...names) {
  for (const name of names) {
    const value = process.env[name];

    if (value !== undefined && value !== "") {
      return value;
    }
  }

  return undefined;
}

function resolveSqlitePath() {
  const configured = getEnv("SQLITE_DATABASE_PATH", "SQLITE_PATH");
  if (!configured) {
    return path.join(backendRoot, "data", "ecommerce.sqlite");
  }

  return path.isAbsolute(configured)
    ? configured
    : path.resolve(backendRoot, configured);
}

function runSerialized(fn) {
  const next = serializedChain.then(fn, fn);
  serializedChain = next.catch(() => {});
  return next;
}

function convertPlaceholders(sqlText, params) {
  if (!params || params.length === 0) {
    return [sqlText, []];
  }

  const values = [];
  const out = sqlText.replace(/\$(\d+)/g, (_, d) => {
    const i = Number.parseInt(d, 10) - 1;
    let v = params[i];
    if (v === undefined) {
      v = null;
    } else if (typeof v === "boolean") {
      v = v ? 1 : 0;
    }
    values.push(v);
    return "?";
  });

  return [out, values];
}

function getDbSync() {
  if (!dbInstance) {
    const filepath = resolveSqlitePath();
    fs.mkdirSync(path.dirname(filepath), { recursive: true });

    const database = new DatabaseSync(filepath);
    database.exec("PRAGMA foreign_keys = ON");
    database.exec("PRAGMA journal_mode = WAL");
    database.sqlitePath = filepath;
    dbInstance = database;
  }

  return dbInstance;
}

function doQuerySync(database, text, params) {
  const [sql, values] = convertPlaceholders(text, params);
  const trimmed = sql.trim();
  const upper = trimmed.replace(/^\(+/, "").toUpperCase();
  const isSelect = upper.startsWith("SELECT") || upper.startsWith("WITH");
  const hasReturning = /\bRETURNING\b/i.test(sql);

  const statement = database.prepare(sql);

  if (isSelect || hasReturning) {
    const rows = statement.all(...values);
    return { rows, rowCount: rows.length };
  }

  const info = statement.run(...values);
  return { rows: [], rowCount: info.changes };
}

export function query(text, params = [], runner) {
  const execute = () => {
    const database = runner || getDbSync();
    return doQuerySync(database, text, params);
  };

  if (runner) {
    return Promise.resolve(execute());
  }

  return runSerialized(() => Promise.resolve(execute()));
}

export async function withTransaction(callback) {
  return runSerialized(async () => {
    const database = getDbSync();
    database.exec("BEGIN IMMEDIATE");

    try {
      const result = await callback(database);
      database.exec("COMMIT");
      return result;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  });
}

export async function initializeDatabase() {
  if (!initializationPromise) {
    initializationPromise = Promise.resolve()
      .then(() => {
        const database = getDbSync();
        database.exec(schemaSql);
        const fp = database.sqlitePath || resolveSqlitePath();

        console.log(`SQLite ready: ${fp}`.underline.cyan);
        dbgDb("ready database=%s", fp);
      })
      .catch((error) => {
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
      `Check SQLITE_DATABASE_PATH in backend/db/.env (see backend/db/.env.example). Node.js 22.5+ is required for built-in SQLite. Data directory must be writable.`
        .yellow
    );
    process.exit(1);
  }
};

export default connectDB;
