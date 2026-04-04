/** SQLite DDL — mirrors former Postgres tables (users, products, orders, order_items, seed_manifest). */
const schemaSql = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  _id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  _id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(_id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  sex TEXT,
  category TEXT NOT NULL,
  sub_category TEXT,
  size TEXT,
  nwt INTEGER NOT NULL DEFAULT 0 CHECK (nwt IN (0, 1)),
  brand TEXT,
  color TEXT NOT NULL,
  sub_color TEXT,
  price REAL NOT NULL,
  count_in_stock INTEGER NOT NULL DEFAULT 1 CHECK (count_in_stock >= 0),
  images TEXT NOT NULL DEFAULT '[]',
  local_images TEXT,
  bucket_name TEXT,
  bucket_region TEXT,
  bucket_public_base_url TEXT,
  bucket_prefix TEXT,
  seed_source TEXT NOT NULL DEFAULT 'products-s3-manifest',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  _id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(_id) ON DELETE SET NULL,
  shipping_address TEXT NOT NULL DEFAULT '{}',
  payment_method TEXT NOT NULL,
  payment_result TEXT,
  items_price REAL NOT NULL DEFAULT 0,
  tax_price REAL NOT NULL DEFAULT 0,
  shipping_price REAL NOT NULL DEFAULT 0,
  total_price REAL NOT NULL DEFAULT 0,
  is_paid INTEGER NOT NULL DEFAULT 0 CHECK (is_paid IN (0, 1)),
  paid_at TEXT,
  is_shipped INTEGER NOT NULL DEFAULT 0 CHECK (is_shipped IN (0, 1)),
  shipped_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  _id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  images TEXT NOT NULL DEFAULT '[]',
  price REAL NOT NULL,
  product_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS seed_manifest (
  source TEXT PRIMARY KEY,
  generated_at TEXT,
  bucket_name TEXT,
  bucket_region TEXT,
  bucket_public_base_url TEXT,
  bucket_prefix TEXT,
  stats TEXT NOT NULL DEFAULT '{}',
  raw_manifest TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sex ON products(sex);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
`;

export default schemaSql;
