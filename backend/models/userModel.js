import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

import { query } from "../config/db.js";
import { toIsoMaybe } from "../utils/toIso.js";

const USER_COLUMNS = `
  _id AS id,
  name,
  email,
  password,
  is_admin,
  created_at,
  updated_at
`;

function normalizeDuplicateUserError(error) {
  const msg = String(error?.message || "");
  const sqliteUnique =
    error?.code === "SQLITE_CONSTRAINT" &&
    (msg.includes("UNIQUE") || msg.includes("unique"));

  if (sqliteUnique) {
    const duplicateUserError = new Error("User already exists");
    duplicateUserError.statusCode = 400;
    throw duplicateUserError;
  }

  throw error;
}

function mapUser(row, { includePassword = false } = {}) {
  if (!row) {
    return null;
  }

  const user = {
    _id: row.id,
    name: row.name,
    email: row.email,
    isAdmin: Boolean(row.is_admin),
    createdAt: toIsoMaybe(row.created_at),
    updatedAt: toIsoMaybe(row.updated_at),
  };

  if (includePassword) {
    user.password = row.password;
  }

  return user;
}

export async function matchPassword(enteredPassword, hashedPassword) {
  return bcrypt.compare(enteredPassword, hashedPassword);
}

export async function findUserByEmail(
  email,
  { includePassword = false, client } = {}
) {
  const { rows } = await query(
    `SELECT ${USER_COLUMNS} FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email],
    client
  );

  return mapUser(rows[0], { includePassword });
}

export async function getUserById(
  id,
  { includePassword = false, client } = {}
) {
  const { rows } = await query(
    `SELECT ${USER_COLUMNS} FROM users WHERE _id = $1 LIMIT 1`,
    [id],
    client
  );

  return mapUser(rows[0], { includePassword });
}

export async function listUsers({ client } = {}) {
  const { rows } = await query(
    `SELECT ${USER_COLUMNS}
     FROM users
     ORDER BY created_at DESC`,
    [],
    client
  );

  return rows.map((row) => mapUser(row));
}

export async function createUser(
  { name, email, password, isAdmin = false, passwordIsHashed = false },
  { includePassword = false, client } = {}
) {
  const hashedPassword = passwordIsHashed
    ? password
    : await bcrypt.hash(password, 10);

  try {
    const { rows } = await query(
      `INSERT INTO users (
        _id,
        name,
        email,
        password,
        is_admin
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING ${USER_COLUMNS}`,
      [randomUUID(), name, email, hashedPassword, isAdmin],
      client
    );

    return mapUser(rows[0], { includePassword });
  } catch (error) {
    normalizeDuplicateUserError(error);
  }
}

export async function updateUserById(
  id,
  {
    name,
    email,
    password,
    isAdmin,
    passwordIsHashed = false,
  },
  { includePassword = false, client } = {}
) {
  const assignments = [];
  const values = [];

  if (name !== undefined) {
    values.push(name);
    assignments.push(`name = $${values.length}`);
  }

  if (email !== undefined) {
    values.push(email);
    assignments.push(`email = $${values.length}`);
  }

  if (password !== undefined) {
    const hashedPassword = passwordIsHashed
      ? password
      : await bcrypt.hash(password, 10);

    values.push(hashedPassword);
    assignments.push(`password = $${values.length}`);
  }

  if (isAdmin !== undefined) {
    values.push(isAdmin);
    assignments.push(`is_admin = $${values.length}`);
  }

  if (assignments.length === 0) {
    return getUserById(id, { includePassword, client });
  }

  assignments.push("updated_at = datetime('now')");
  values.push(id);

  try {
    const { rows } = await query(
      `UPDATE users
       SET ${assignments.join(", ")}
       WHERE _id = $${values.length}
       RETURNING ${USER_COLUMNS}`,
      values,
      client
    );

    return mapUser(rows[0], { includePassword });
  } catch (error) {
    normalizeDuplicateUserError(error);
  }
}

export async function deleteUserById(id, { client } = {}) {
  const result = await query(`DELETE FROM users WHERE _id = $1`, [id], client);
  return result.rowCount > 0;
}

export async function deleteAllUsers(client) {
  await query(`DELETE FROM users`, [], client);
}

export async function insertUsers(users, client) {
  const createdUsers = [];

  for (const user of users) {
    createdUsers.push(
      await createUser(
        {
          ...user,
          passwordIsHashed: true,
        },
        { client }
      )
    );
  }

  return createdUsers;
}
