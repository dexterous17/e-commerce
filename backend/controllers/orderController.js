import asyncHandler from "express-async-handler";

import {
  createOrder as createOrderRecord,
  getOrderById as getOrderByIdRecord,
  listOrders,
  listOrdersByUser,
  updateOrderToPaid as markOrderPaid,
  updateOrderToShipped as markOrderShipped,
} from "../models/orderModel.js";
import {
  canonicalizeImageUrlsForStorage,
  mapOrderImagesForApi,
} from "../utils/mediaImageUrls.js";

// @desc      Create all products
// @route     POST /api/orders/
// @access    private
export const addOrderItems = asyncHandler(async (req, res) => {
  const {
    orderItems,
    shippingAddress,
    paymentMethod,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
  } = req.body;

  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    res.status(400);
    throw new Error("No order items");
  }

  const normalizedItems = orderItems.map((item) => ({
    ...item,
    images: Array.isArray(item.images)
      ? canonicalizeImageUrlsForStorage(item.images)
      : item.images,
  }));

  const createdOrder = await createOrderRecord({
    userId: req.user._id,
    orderItems: normalizedItems,
    shippingAddress,
    paymentMethod,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
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

  res.json(mapOrderImagesForApi(order));
});

// @desc      update order to paid
// @route     PUT /api/orders/:id/pay
// @access    private
export const updateOrderPaidStatus = asyncHandler(async (req, res) => {
  const order = await markOrderPaid(req.params.id, {
    id: req.body.id,
    status: req.body.status,
    update_time: req.body.update_time,
    email_address: req.body.payer?.email_address,
  });

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
  res.json(await listOrdersByUser(req.user._id));
});

// @desc      get all orders
// @route     GET /api/orders
// @access    private/admin
export const getOrders = asyncHandler(async (req, res) => {
  res.json(await listOrders());
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
