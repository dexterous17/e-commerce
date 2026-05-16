#!/usr/bin/env node
/**
 * Validates live PostgreSQL metadata against `db/schemaExpectation.js`
 * (must match `db/schema.js` DDL). Uses the same env resolution as the API.
 *
 * Usage (from repo root or backend/):
 *   node backend/scripts/validate-db-schema.mjs
 *   node backend/scripts/validate-db-schema.mjs --strict
 *   npm run db:validate-schema --prefix backend
 */
import pg from "pg";

import "../config/loadEnv.js";
import { resolveDatabaseConnectionString } from "../config/db.js";
import { schemaExpectation } from "../db/schemaExpectation.js";

const { Pool } = pg;

function normalizePgDataType(dataType, udtName) {
  if (dataType === "USER-DEFINED" && udtName) {
    return udtName.toLowerCase();
  }
  return dataType.toLowerCase();
}

/** Columns where the DDL uses TEXT but production often uses JSONB (node-pg still maps both). */
const JSON_TEXT_COLUMN_KEYS = new Set([
  "products.images",
  "products.local_images",
  "orders.shipping_address",
  "orders.payment_result",
  "order_items.images",
  "seed_manifest.stats",
  "seed_manifest.raw_manifest",
]);

/** Columns where the DDL uses TEXT IDs but databases may use UUID. */
const ID_TEXT_COLUMN_KEYS = new Set([
  "users._id",
  "products._id",
  "products.user_id",
  "orders._id",
  "orders.user_id",
  "order_items._id",
  "order_items.order_id",
  "order_items.product_id",
]);

function typesCompatible(strict, tableName, colName, expectedType, actualType) {
  const expected = expectedType.toLowerCase();
  const actual = actualType.toLowerCase();
  if (actual === expected) {
    return { ok: true };
  }

  if (strict) {
    return {
      ok: false,
      detail: `expected type "${expected}", got "${actual}"`,
    };
  }

  if (
    expected === "double precision" &&
    (actual === "numeric" || actual === "real")
  ) {
    return { ok: true, note: `relaxed: "${actual}" accepted as "${expected}"` };
  }

  const key = `${tableName}.${colName}`;
  if (expected === "text" && actual === "uuid" && ID_TEXT_COLUMN_KEYS.has(key)) {
    return { ok: true, note: `relaxed: uuid accepted for text id column` };
  }

  if (
    expected === "text" &&
    actual === "jsonb" &&
    JSON_TEXT_COLUMN_KEYS.has(key)
  ) {
    return { ok: true, note: `relaxed: jsonb accepted for JSON-as-text column` };
  }

  return {
    ok: false,
    detail: `expected type "${expected}" (strict) or compatible substitute, got "${actual}"`,
  };
}

async function loadColumns(client) {
  const tables = Object.keys(schemaExpectation.tables);
  const { rows } = await client.query(
    `SELECT table_name, column_name, data_type, udt_name, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])
     ORDER BY table_name, ordinal_position`,
    [tables]
  );
  const byTable = new Map();
  for (const row of rows) {
    const t = row.table_name;
    if (!byTable.has(t)) byTable.set(t, []);
    byTable.get(t).push({
      column_name: row.column_name,
      data_type: normalizePgDataType(row.data_type, row.udt_name),
      is_nullable: row.is_nullable === "YES",
    });
  }
  return byTable;
}

async function loadPrimaryKeys(client) {
  const { rows } = await client.query(
    `SELECT tc.table_name, kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     WHERE tc.table_schema = 'public'
       AND tc.constraint_type = 'PRIMARY KEY'
     ORDER BY tc.table_name, kcu.ordinal_position`
  );
  const byTable = new Map();
  for (const row of rows) {
    if (!byTable.has(row.table_name)) byTable.set(row.table_name, []);
    byTable.get(row.table_name).push(row.column_name);
  }
  return byTable;
}

async function loadIndexes(client) {
  const { rows } = await client.query(
    `SELECT indexname, tablename
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname NOT LIKE 'pg_%'`
  );
  return new Map(rows.map((r) => [r.indexname, r.tablename]));
}

async function loadForeignKeys(client) {
  const { rows } = await client.query(
    `SELECT
       tc.table_name AS from_table,
       kcu.column_name AS from_column,
       ccu.table_name AS to_table,
       ccu.column_name AS to_column,
       tc.constraint_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
     WHERE tc.table_schema = 'public'
       AND tc.constraint_type = 'FOREIGN KEY'`
  );
  return rows.map((r) => ({
    fromTable: r.from_table,
    fromColumn: r.from_column,
    toTable: r.to_table,
    toColumn: r.to_column,
    constraintName: r.constraint_name,
  }));
}

function fkSignature(fromTable, fromCols, toTable, toCols) {
  return `${fromTable}(${fromCols.join(",")})→${toTable}(${toCols.join(",")})`;
}

function validate() {
  const connectionString = resolveDatabaseConnectionString();
  if (!connectionString) {
    console.error(
      "Missing database URL. Set DATABASE_URL or PGHOST/PGUSER/PGDATABASE (see backend/db/.env.example)."
    );
    process.exit(1);
  }

  return connectionString;
}

async function main() {
  const strict = process.argv.includes("--strict");
  const connectionString = validate();
  const pool = new Pool({ connectionString });
  const errors = [];
  const warnings = [];

  try {
    const client = await pool.connect();
    try {
      const columnsByTable = await loadColumns(client);
      const pkByTable = await loadPrimaryKeys(client);
      const indexMap = await loadIndexes(client);
      const fkRows = await loadForeignKeys(client);

      for (const [tableName, spec] of Object.entries(schemaExpectation.tables)) {
        const actualCols = columnsByTable.get(tableName);
        if (!actualCols?.length) {
          errors.push(`Table "${tableName}" is missing or has no columns.`);
          continue;
        }

        const actualMap = new Map(
          actualCols.map((c) => [c.column_name, c])
        );

        for (const [colName, colSpec] of Object.entries(spec.columns)) {
          const actual = actualMap.get(colName);
          if (!actual) {
            errors.push(`Table "${tableName}" missing column "${colName}".`);
            continue;
          }
          const expectedType = colSpec.dataType.toLowerCase();
          const compat = typesCompatible(
            strict,
            tableName,
            colName,
            expectedType,
            actual.data_type
          );
          if (!compat.ok) {
            errors.push(
              `Table "${tableName}" column "${colName}": ${compat.detail}.`
            );
          } else if (compat.note) {
            warnings.push(`Table "${tableName}" column "${colName}": ${compat.note}.`);
          }
          const expectNull = colSpec.nullable;
          if (actual.is_nullable !== expectNull) {
            errors.push(
              `Table "${tableName}" column "${colName}": expected nullable=${expectNull}, got ${actual.is_nullable}.`
            );
          }
        }

        for (const colName of actualMap.keys()) {
          if (!spec.columns[colName]) {
            warnings.push(
              `Table "${tableName}" has extra column "${colName}" (not in schemaExpectation.js).`
            );
          }
        }

        const expectedPk = spec.primaryKey.join(",");
        const actualPk = (pkByTable.get(tableName) || []).join(",");
        if (actualPk !== expectedPk) {
          errors.push(
            `Table "${tableName}" primary key columns: expected [${expectedPk}], got [${actualPk || "(none)"}].`
          );
        }
      }

      for (const idx of schemaExpectation.indexes) {
        const tab = indexMap.get(idx.name);
        if (!tab) {
          errors.push(`Missing index "${idx.name}" (expected on "${idx.table}").`);
        } else if (tab !== idx.table) {
          errors.push(
            `Index "${idx.name}" is on "${tab}" but schema expects table "${idx.table}".`
          );
        }
      }

      const fkSignatures = new Set(
        fkRows.map((r) =>
          fkSignature(r.fromTable, [r.fromColumn], r.toTable, [r.toColumn])
        )
      );

      for (const fk of schemaExpectation.foreignKeys) {
        const sig = fkSignature(
          fk.fromTable,
          fk.fromColumns,
          fk.toTable,
          fk.toColumns
        );
        if (!fkSignatures.has(sig)) {
          errors.push(`Missing foreign key ${sig}.`);
        }
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }

  for (const w of warnings) console.warn(`WARN: ${w}`);
  if (errors.length) {
    console.error("Schema validation failed:\n");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log(
    strict
      ? "Schema validation passed (strict types match schema.js DDL exactly)."
      : "Schema validation passed: tables, columns, nullability, primary keys, indexes, and foreign keys match application requirements (types: strict DDL or production-compatible uuid/jsonb/numeric where applicable). Use --strict to require exact PostgreSQL types from schema.js."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
