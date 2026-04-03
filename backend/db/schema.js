const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  _id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  _id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(_id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  sex TEXT,
  category TEXT NOT NULL,
  sub_category TEXT,
  size TEXT,
  nwt BOOLEAN NOT NULL DEFAULT FALSE,
  brand TEXT,
  color TEXT NOT NULL,
  sub_color TEXT,
  price NUMERIC(10, 2) NOT NULL,
  count_in_stock INTEGER NOT NULL DEFAULT 1 CHECK (count_in_stock >= 0),
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  local_images JSONB,
  bucket_name TEXT,
  bucket_region TEXT,
  bucket_public_base_url TEXT,
  bucket_prefix TEXT,
  seed_source TEXT NOT NULL DEFAULT 'products-s3-manifest',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  _id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(_id) ON DELETE SET NULL,
  shipping_address JSONB NOT NULL,
  payment_method TEXT NOT NULL,
  payment_result JSONB,
  items_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  tax_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  shipping_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  is_shipped BOOLEAN NOT NULL DEFAULT FALSE,
  shipped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  _id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  price NUMERIC(10, 2) NOT NULL,
  product_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seed_manifest (
  source TEXT PRIMARY KEY,
  generated_at TIMESTAMPTZ,
  bucket_name TEXT,
  bucket_region TEXT,
  bucket_public_base_url TEXT,
  bucket_prefix TEXT,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sex ON products(sex);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
`;

export default schemaSql;
