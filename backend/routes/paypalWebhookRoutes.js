import asyncHandler from "express-async-handler";

import { getOrderById, updateOrderToPaid } from "../models/orderModel.js";
import { dbgError, dbgServer } from "../utils/debugLog.js";
import { verifyPayPalWebhookEvent } from "../utils/paypalVerify.js";

const SHOP_ORDER_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function roundMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) {
    return NaN;
  }
  return Math.round(x * 100) / 100;
}

/**
 * PayPal sends application/json; body must be raw for signature verification.
 * @type {import("express").RequestHandler}
 */
export const paypalWebhookHandler = asyncHandler(async (req, res) => {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();

  let event;
  try {
    const raw = req.body;
    const text =
      Buffer.isBuffer(raw) ? raw.toString("utf8") : typeof raw === "string" ? raw : "";
    event = text ? JSON.parse(text) : {};
  } catch {
    res.status(400).send("Invalid JSON");
    return;
  }

  if (!webhookId) {
    dbgServer("PayPal webhook received but PAYPAL_WEBHOOK_ID is not set (ignoring)");
    res.status(200).json({ received: true, ignored: true });
    return;
  }

  const verified = await verifyPayPalWebhookEvent(req.headers, event, webhookId);
  if (!verified) {
    res.status(400).send("Invalid webhook signature");
    return;
  }

  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const resource = event.resource || {};
    const customIdRaw =
      resource.custom_id != null
        ? String(resource.custom_id).trim()
        : resource.invoice_id != null
          ? String(resource.invoice_id).trim()
          : "";

    if (customIdRaw && SHOP_ORDER_UUID.test(customIdRaw)) {
      const order = await getOrderById(customIdRaw);
      if (order && !order.isPaid) {
        const amount = roundMoney(resource.amount?.value);
        const currency = String(resource.amount?.currency_code || "USD").toUpperCase();
        const totalOk =
          currency === "USD" &&
          Number.isFinite(amount) &&
          Math.abs(amount - roundMoney(order.totalPrice)) <= 0.02;

        if (totalOk) {
          await updateOrderToPaid(customIdRaw, {
            source: "paypal_webhook",
            captureId: resource.id,
            eventId: event.id,
          });
        } else {
          dbgError(
            "PayPal webhook: amount/currency mismatch for order %s (expected %s got %s %s)",
            customIdRaw,
            order.totalPrice,
            resource.amount?.value,
            currency
          );
        }
      }
    }
  }

  res.status(200).json({ received: true });
});
