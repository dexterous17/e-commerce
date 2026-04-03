import asyncHandler from "express-async-handler";

import {
  createOrder as createOrderRecord,
  getOrderById as getOrderByIdRecord,
  listOrders,
  listOrdersByUser,
  updateOrderToPaid as markOrderPaid,
  updateOrderToShipped as markOrderShipped,
} from "../models/orderModel.js";
import { getProductsByIds } from "../models/productModel.js";
import {
  canonicalizeImageUrlsForStorage,
  mapOrderImagesForApi,
} from "../utils/mediaImageUrls.js";
import { verifyPayPalCheckoutOrder } from "../utils/paypalVerify.js";

function roundMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) {
    return 0;
  }
  return Math.round(x * 100) / 100;
}

function orderOwnerId(order) {
  if (!order) {
    return null;
  }
  if (typeof order.user === "string") {
    return order.user;
  }
  return order.user?._id ?? null;
}

function assertOrderReadable(order, req) {
  const owner = orderOwnerId(order);
  const isOwner = owner != null && String(owner) === String(req.user._id);
  if (isOwner || req.user.isAdmin) {
    return;
  }
  const err = new Error("Not authorized to view this order");
  err.statusCode = 403;
  throw err;
}

function assertOrderPaymentByOwner(order, req) {
  const owner = orderOwnerId(order);
  if (owner != null && String(owner) === String(req.user._id)) {
    return;
  }
  const err = new Error("Not authorized to pay this order");
  err.statusCode = 403;
  throw err;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveOrderItemsFromCatalog(orderItems) {
  const ids = [];
  for (const item of orderItems) {
    const raw = item?.product;
    const pid = raw != null ? String(raw).trim() : "";
    if (!pid || !UUID_RE.test(pid)) {
      const err = new Error("Invalid product reference in cart");
      err.statusCode = 400;
      throw err;
    }
    ids.push(pid);
  }

  const productMap = await getProductsByIds(ids);
  const resolved = [];

  for (const item of orderItems) {
    const pid = String(item.product).trim();
    const product = productMap.get(pid);
    if (!product) {
      const err = new Error("One or more products are no longer available");
      err.statusCode = 400;
      throw err;
    }
    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty < 1) {
      const err = new Error("Invalid quantity");
      err.statusCode = 400;
      throw err;
    }
    if (qty > product.countInStock) {
      const err = new Error(`Insufficient stock for ${product.name}`);
      err.statusCode = 400;
      throw err;
    }

    const imagesForStore = Array.isArray(item.images)
      ? canonicalizeImageUrlsForStorage(item.images)
      : product.images;

    resolved.push({
      name: product.name,
      qty,
      images: imagesForStore,
      price: product.price,
      product: String(product._id),
    });
  }

  const itemsPrice = roundMoney(
    resolved.reduce((sum, line) => sum + line.qty * line.price, 0)
  );
  return { resolved, itemsPrice };
}

// @desc      Create all products
// @route     POST /api/orders/
// @access    private
export const addOrderItems = asyncHandler(async (req, res) => {
  const {
    orderItems,
    shippingAddress,
    paymentMethod,
    itemsPrice: clientItemsPrice,
    taxPrice: clientTaxPrice,
    shippingPrice: clientShippingPrice,
    totalPrice: clientTotalPrice,
  } = req.body;

  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    res.status(400);
    throw new Error("No order items");
  }

  if (
    typeof shippingAddress !== "object" ||
    shippingAddress == null ||
    Array.isArray(shippingAddress)
  ) {
    res.status(400);
    throw new Error("Shipping address is required");
  }

  if (!paymentMethod || typeof paymentMethod !== "string") {
    res.status(400);
    throw new Error("Payment method is required");
  }

  const { resolved, itemsPrice: serverItemsPrice } =
    await resolveOrderItemsFromCatalog(orderItems);

  if (Math.abs(serverItemsPrice - roundMoney(clientItemsPrice)) > 0.02) {
    res.status(400);
    throw new Error("Cart prices are out of date — refresh and try again");
  }

  const taxPrice = roundMoney(clientTaxPrice);
  const shippingPrice = roundMoney(clientShippingPrice);
  const serverTotal = roundMoney(serverItemsPrice + taxPrice + shippingPrice);

  if (Math.abs(serverTotal - roundMoney(clientTotalPrice)) > 0.02) {
    res.status(400);
    throw new Error("Order total is invalid — refresh and try again");
  }

  const createdOrder = await createOrderRecord({
    userId: req.user._id,
    orderItems: resolved,
    shippingAddress,
    paymentMethod,
    itemsPrice: serverItemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice: serverTotal,
  });

  res.status(201).json(mapOrderImagesForApi(createdOrder));
});

// @desc      Get order by id
// @route     GET /api/orders/:id
// @access    private
export const getOrderByIdHandler = asyncHandler(async (req, res) => {
  const order = await getOrderByIdRecord(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  assertOrderReadable(order, req);

  res.json(mapOrderImagesForApi(order));
});

// @desc      update order to paid
// @route     PUT /api/orders/:id/pay
// @access    private
export const updateOrderPaidStatus = asyncHandler(async (req, res) => {
  const existing = await getOrderByIdRecord(req.params.id);

  if (!existing) {
    res.status(404);
    throw new Error("Order not found");
  }

  assertOrderPaymentByOwner(existing, req);

  if (existing.isPaid) {
    res.json(mapOrderImagesForApi(existing));
    return;
  }

  const paypalOrderId = req.body?.id;
  if (!paypalOrderId || typeof paypalOrderId !== "string") {
    res.status(400);
    throw new Error("PayPal order id is required to confirm payment");
  }

  const verification = await verifyPayPalCheckoutOrder({
    paypalOrderId,
    shopOrderId: req.params.id,
    expectedTotalUsd: existing.totalPrice,
  });

  const paymentResult = {
    id: req.body.id,
    status: req.body.status,
    update_time: req.body.update_time,
    email_address: req.body.payer?.email_address,
    serverVerifiedAt: new Date().toISOString(),
    payPalVerificationSkipped: Boolean(verification.skipped),
  };

  const order = await markOrderPaid(req.params.id, paymentResult);

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  res.json(mapOrderImagesForApi(order));
});

// @desc      get logged in user orders
// @route     GET /api/orders/myorders
// @access    private
export const getMyOrders = asyncHandler(async (req, res) => {
  const rows = await listOrdersByUser(req.user._id);
  res.json(rows.map((o) => mapOrderImagesForApi(o)));
});

// @desc      get all orders
// @route     GET /api/orders
// @access    private/admin
export const getOrders = asyncHandler(async (req, res) => {
  const rows = await listOrders();
  res.json(rows.map((o) => mapOrderImagesForApi(o)));
});

// @desc      update order to shipped
// @route     PUT /api/orders/:id/ship
// @access    private/admin
export const updateOrderShipmentStatus = asyncHandler(async (req, res) => {
  const order = await markOrderShipped(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  res.json(mapOrderImagesForApi(order));
});

export {
  getOrderByIdHandler as getOrderById,
  updateOrderPaidStatus as updateOrderToPaid,
  updateOrderShipmentStatus as updateOrderToShipped,
};
