import { randomUUID } from "crypto";

import { query, withTransaction } from "../config/db.js";

const ORDER_COLUMNS = `
  o._id AS id,
  o.user_id,
  o.shipping_address,
  o.payment_method,
  o.payment_result,
  o.items_price,
  o.tax_price,
  o.shipping_price,
  o.total_price,
  o.is_paid,
  o.paid_at,
  o.is_shipped,
  o.shipped_at,
  o.created_at,
  o.updated_at
`;

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

function mapOrderItem(row) {
  return {
    name: row.name,
    qty: row.qty,
    images: normalizeImages(row.images),
    price: Number(row.price),
    product: row.product_id,
  };
}

function mapOrder(row, { includeUser = false, includeItems = false } = {}) {
  if (!row) {
    return null;
  }

  const order = {
    _id: row.id,
    user: includeUser
      ? {
          _id: row.user_id || "",
          name: row.user_name || "",
          email: row.user_email || "",
        }
      : row.user_id,
    shippingAddress: row.shipping_address || {},
    paymentMethod: row.payment_method,
    paymentResult: row.payment_result || undefined,
    itemsPrice: Number(row.items_price),
    taxPrice: Number(row.tax_price),
    shippingPrice: Number(row.shipping_price),
    totalPrice: Number(row.total_price),
    isPaid: row.is_paid,
    paidAt: row.paid_at?.toISOString() || null,
    isShipped: row.is_shipped,
    shippedAt: row.shipped_at?.toISOString() || null,
    createdAt: row.created_at?.toISOString() || null,
    updatedAt: row.updated_at?.toISOString() || null,
  };

  if (includeItems) {
    order.orderItems = row.orderItems || [];
  }

  return order;
}

async function getOrderItems(orderId, client) {
  const { rows } = await query(
    `SELECT name, qty, images, price, product_id
     FROM order_items
     WHERE order_id = $1
     ORDER BY created_at ASC`,
    [orderId],
    client
  );

  return rows.map(mapOrderItem);
}

async function getOrderRecord(id, client) {
  const { rows } = await query(
    `SELECT ${ORDER_COLUMNS},
            u.name AS user_name,
            u.email AS user_email
     FROM orders o
     LEFT JOIN users u ON u._id = o.user_id
     WHERE o._id = $1
     LIMIT 1`,
    [id],
    client
  );

  return rows[0] || null;
}

async function getDetailedOrder(id, client) {
  const orderRecord = await getOrderRecord(id, client);

  if (!orderRecord) {
    return null;
  }

  return mapOrder(
    {
      ...orderRecord,
      orderItems: await getOrderItems(id, client),
    },
    { includeUser: true, includeItems: true }
  );
}

export async function createOrder({
  userId,
  orderItems,
  shippingAddress,
  paymentMethod,
  itemsPrice,
  taxPrice,
  shippingPrice,
  totalPrice,
}) {
  return withTransaction(async (client) => {
    const orderId = randomUUID();
    const items = Array.isArray(orderItems) ? orderItems : [];

    for (const item of items) {
      const qty = Number(item.qty || 0);
      const productId = item.product;
      if (!productId || !Number.isFinite(qty) || qty < 1) {
        const e = new Error("Invalid order line item");
        e.statusCode = 400;
        throw e;
      }

      const { rows: stockRows } = await query(
        `UPDATE products
         SET count_in_stock = count_in_stock - $1,
             updated_at = NOW()
         WHERE _id = $2 AND count_in_stock >= $1
         RETURNING _id`,
        [qty, productId],
        client
      );

      if (stockRows.length === 0) {
        const e = new Error(
          "Insufficient stock or product unavailable — refresh your cart and try again"
        );
        e.statusCode = 400;
        throw e;
      }
    }

    await query(
      `INSERT INTO orders (
        _id,
        user_id,
        shipping_address,
        payment_method,
        items_price,
        tax_price,
        shipping_price,
        total_price
      ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8)`,
      [
        orderId,
        userId,
        JSON.stringify(shippingAddress || {}),
        paymentMethod,
        Number(itemsPrice || 0),
        Number(taxPrice || 0),
        Number(shippingPrice || 0),
        Number(totalPrice || 0),
      ],
      client
    );

    for (const item of items) {
      await query(
        `INSERT INTO order_items (
          _id,
          order_id,
          name,
          qty,
          images,
          price,
          product_id
        ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
        [
          randomUUID(),
          orderId,
          item.name,
          Number(item.qty || 0),
          JSON.stringify(normalizeImages(item.images)),
          Number(item.price || 0),
          item.product,
        ],
        client
      );
    }

    return getDetailedOrder(orderId, client);
  });
}

export async function getOrderById(id, { client } = {}) {
  return getDetailedOrder(id, client);
}

export async function updateOrderToPaid(id, paymentResult = {}) {
  return withTransaction(async (client) => {
    const { rows } = await query(
      `UPDATE orders
       SET is_paid = TRUE,
           paid_at = NOW(),
           payment_result = $1::jsonb,
           updated_at = NOW()
       WHERE _id = $2
       RETURNING _id`,
      [JSON.stringify(paymentResult || {}), id],
      client
    );

    if (rows.length === 0) {
      return null;
    }

    return getDetailedOrder(id, client);
  });
}

export async function updateOrderToShipped(id) {
  return withTransaction(async (client) => {
    const { rows } = await query(
      `UPDATE orders
       SET is_shipped = TRUE,
           shipped_at = NOW(),
           updated_at = NOW()
       WHERE _id = $1
       RETURNING _id`,
      [id],
      client
    );

    if (rows.length === 0) {
      return null;
    }

    return getDetailedOrder(id, client);
  });
}

export async function listOrdersByUser(userId) {
  const { rows } = await query(
    `SELECT ${ORDER_COLUMNS}
     FROM orders o
     WHERE o.user_id = $1
     ORDER BY o.created_at DESC`,
    [userId]
  );

  return rows.map((row) => mapOrder(row));
}

export async function listOrders() {
  const { rows } = await query(
    `SELECT ${ORDER_COLUMNS},
            u.name AS user_name,
            u.email AS user_email
     FROM orders o
     LEFT JOIN users u ON u._id = o.user_id
     ORDER BY o.created_at DESC`
  );

  return rows.map((row) => mapOrder(row, { includeUser: true }));
}

export async function deleteAllOrders(client) {
  await query(`DELETE FROM orders`, [], client);
}
