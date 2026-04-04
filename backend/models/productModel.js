import { randomUUID } from "crypto";

import { query } from "../config/db.js";
import { toIsoMaybe } from "../utils/toIso.js";

const PRODUCT_COLUMNS = `
  _id AS id,
  user_id,
  name,
  nwt,
  brand,
  price,
  size,
  description,
  sex,
  category,
  sub_category,
  color,
  sub_color,
  count_in_stock,
  images,
  local_images,
  bucket_name,
  bucket_region,
  bucket_public_base_url,
  bucket_prefix,
  seed_source,
  created_at,
  updated_at
`;

const SEARCHABLE_COLUMNS = {
  brand: "brand",
  category: "category",
  color: "color",
  description: "description",
  name: "name",
  sex: "sex",
  size: "size",
  subCategory: "sub_category",
  subColor: "sub_color",
};

function normalizeImages(images) {
  if (typeof images === "string") {
    try {
      return normalizeImages(JSON.parse(images));
    } catch {
      return [];
    }
  }

  return Array.isArray(images) ? images.filter(Boolean).map(String) : [];
}

function mapProduct(row) {
  if (!row) {
    return null;
  }

  return {
    _id: row.id,
    user: row.user_id,
    name: row.name,
    nwt: Boolean(row.nwt),
    brand: row.brand,
    price: Number(row.price),
    size: row.size,
    description: row.description,
    sex: row.sex,
    category: row.category,
    subCategory: row.sub_category,
    color: row.color,
    subColor: row.sub_color,
    countInStock: row.count_in_stock,
    images: normalizeImages(row.images),
    localImages: normalizeImages(row.local_images),
    bucketName: row.bucket_name || null,
    bucketRegion: row.bucket_region || null,
    bucketPublicBaseUrl: row.bucket_public_base_url || null,
    bucketPrefix: row.bucket_prefix || null,
    seedSource: row.seed_source || null,
    createdAt: toIsoMaybe(row.created_at),
    updatedAt: toIsoMaybe(row.updated_at),
  };
}

function normalizeFilter(filter) {
  const value = String(filter || "").trim();

  if (value === "title") {
    return "name";
  }

  if (value === "gender") {
    return "sex";
  }

  if (SEARCHABLE_COLUMNS[value]) {
    return value;
  }

  return "name";
}

const MAX_PAGE_SIZE = 100;

export async function listProducts({
  keyword = "",
  filter = "name",
  page = 1,
  pageSize = 50,
} = {}) {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  let safePageSize =
    Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 50;
  if (safePageSize > MAX_PAGE_SIZE) {
    safePageSize = MAX_PAGE_SIZE;
  }
  const normalizedFilter = normalizeFilter(filter);
  const column = SEARCHABLE_COLUMNS[normalizedFilter];
  const trimmedKeyword = String(keyword || "").trim();
  const hasKeyword = trimmedKeyword.length > 0;
  const params = hasKeyword ? [`%${trimmedKeyword}%`] : [];
  const whereClause = hasKeyword
    ? `WHERE LOWER(${column}) LIKE LOWER($1)`
    : "";

  const countResult = await query(
    `SELECT CAST(COUNT(*) AS INTEGER) AS count FROM products ${whereClause}`,
    params
  );
  const count = Number(countResult.rows[0]?.count || 0);
  const productParams = [
    ...params,
    safePageSize,
    safePageSize * (safePage - 1),
  ];

  const { rows } = await query(
    `SELECT ${PRODUCT_COLUMNS}
     FROM products
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${productParams.length - 1}
     OFFSET $${productParams.length}`,
    productParams
  );

  return {
    count,
    products: rows.map(mapProduct),
    page: safePage,
    pages: Math.ceil(count / safePageSize),
  };
}

export async function getProductById(id, { client } = {}) {
  const { rows } = await query(
    `SELECT ${PRODUCT_COLUMNS} FROM products WHERE _id = $1 LIMIT 1`,
    [id],
    client
  );

  return mapProduct(rows[0]);
}

/** Returns a Map of product `_id` string → mapped product row. Unknown ids are omitted. */
export async function getProductsByIds(ids, { client } = {}) {
  const unique = [...new Set((ids || []).filter(Boolean).map(String))];
  if (unique.length === 0) {
    return new Map();
  }

  const placeholders = unique.map((_, index) => `$${index + 1}`).join(", ");
  const { rows } = await query(
    `SELECT ${PRODUCT_COLUMNS} FROM products WHERE _id IN (${placeholders})`,
    unique,
    client
  );

  const map = new Map();
  for (const row of rows) {
    const product = mapProduct(row);
    if (product?._id) {
      map.set(String(product._id), product);
    }
  }
  return map;
}

export async function createProduct(product, { client } = {}) {
  const { rows } = await query(
      `INSERT INTO products (
      _id,
      user_id,
      name,
      nwt,
      brand,
      price,
      size,
      description,
      sex,
      category,
      sub_category,
      color,
      sub_color,
      count_in_stock,
      images,
      local_images,
      bucket_name,
      bucket_region,
      bucket_public_base_url,
      bucket_prefix,
      seed_source
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20, $21
    )
    RETURNING ${PRODUCT_COLUMNS}`,
    [
      randomUUID(),
      product.user,
      product.name,
      Boolean(product.nwt),
      product.brand || null,
      Number(product.price || 0),
      product.size || null,
      product.description,
      product.sex || null,
      product.category,
      product.subCategory || null,
      product.color,
      product.subColor || null,
      Number(product.countInStock ?? 1),
      JSON.stringify(normalizeImages(product.images)),
      JSON.stringify(normalizeImages(product.localImages)),
      product.bucketName || null,
      product.bucketRegion || null,
      product.bucketPublicBaseUrl || null,
      product.bucketPrefix || null,
      product.seedSource || "manual-api",
    ],
    client
  );

  return mapProduct(rows[0]);
}

export async function updateProductById(id, product, { client } = {}) {
  const { rows } = await query(
    `UPDATE products
     SET user_id = $1,
         name = $2,
         nwt = $3,
         brand = $4,
         price = $5,
         size = $6,
         description = $7,
         sex = $8,
         category = $9,
         sub_category = $10,
         color = $11,
         sub_color = $12,
         count_in_stock = $13,
         images = $14,
         updated_at = datetime('now')
     WHERE _id = $15
     RETURNING ${PRODUCT_COLUMNS}`,
    [
      product.user || null,
      product.name,
      Boolean(product.nwt),
      product.brand || null,
      Number(product.price || 0),
      product.size || null,
      product.description,
      product.sex || null,
      product.category,
      product.subCategory || null,
      product.color,
      product.subColor || null,
      Number(product.countInStock ?? 0),
      JSON.stringify(normalizeImages(product.images)),
      id,
    ],
    client
  );

  return mapProduct(rows[0]);
}

export async function setProductInventoryToZero(id, { client } = {}) {
  const { rows } = await query(
    `UPDATE products
     SET count_in_stock = 0,
         updated_at = datetime('now')
     WHERE _id = $1
     RETURNING ${PRODUCT_COLUMNS}`,
    [id],
    client
  );

  return mapProduct(rows[0]);
}

export async function deleteProductById(id, { client } = {}) {
  const result = await query(`DELETE FROM products WHERE _id = $1`, [id], client);
  return result.rowCount > 0;
}

export async function getFeaturedProducts(limit = 10) {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;
  const { rows } = await query(
    `SELECT ${PRODUCT_COLUMNS}
     FROM products
     ORDER BY price DESC
     LIMIT $1`,
    [safeLimit]
  );

  return rows.map(mapProduct);
}

export async function deleteAllProducts(client) {
  await query(`DELETE FROM products`, [], client);
}

export async function insertProducts(products, client) {
  const createdProducts = [];

  for (const product of products) {
    createdProducts.push(await createProduct(product, { client }));
  }

  return createdProducts;
}
