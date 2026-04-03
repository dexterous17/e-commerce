import { dbgError, dbgServer } from "./debugLog.js";

function getPayPalApiBase() {
  const mode = String(process.env.PAYPAL_MODE || "sandbox")
    .trim()
    .toLowerCase();
  if (mode === "live" || mode === "production") {
    return "https://api-m.paypal.com";
  }
  return "https://api-m.sandbox.paypal.com";
}

function roundMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) {
    return NaN;
  }
  return Math.round(x * 100) / 100;
}

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const secret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !secret) {
    return null;
  }

  const base = getPayPalApiBase();
  const auth = Buffer.from(`${clientId}:${secret}`, "utf8").toString("base64");
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    dbgError("PayPal token request failed: %s %s", res.status, text.slice(0, 300));
    const err = new Error(`PayPal token request failed (${res.status})`);
    err.statusCode = 502;
    throw err;
  }

  const data = await res.json();
  return data.access_token;
}

function extractCaptureAndCustom(orderPayload) {
  const unit = orderPayload?.purchase_units?.[0];
  const customId =
    unit?.custom_id != null ? String(unit.custom_id).trim() : "";
  const capture = unit?.payments?.captures?.[0];
  if (capture?.amount?.value != null) {
    return {
      customId,
      amountValue: roundMoney(capture.amount.value),
      currency: String(capture.amount.currency_code || "USD").toUpperCase(),
      status: String(capture.status || ""),
      orderStatus: String(orderPayload?.status || ""),
    };
  }

  return {
    customId,
    amountValue: NaN,
    currency: "USD",
    status: "",
    orderStatus: String(orderPayload?.status || ""),
  };
}

/**
 * Confirms a PayPal Checkout order was captured and matches our shop order.
 * @param {object} opts
 * @param {string} opts.paypalOrderId - PayPal order ID from the client SDK (details.id)
 * @param {string} opts.shopOrderId - Our UUID (must match purchase_units[0].custom_id)
 * @param {number} opts.expectedTotalUsd - Order.totalPrice from DB
 */
export async function verifyPayPalCheckoutOrder({
  paypalOrderId,
  shopOrderId,
  expectedTotalUsd,
}) {
  if (!paypalOrderId || typeof paypalOrderId !== "string") {
    const err = new Error("Missing PayPal order id");
    err.statusCode = 400;
    throw err;
  }

  const secret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  const skipVerify =
    process.env.PAYPAL_SKIP_VERIFY === "true" ||
    process.env.PAYPAL_SKIP_VERIFY === "1";
  const isProd = process.env.NODE_ENV === "production";

  if (!secret) {
    if (isProd) {
      const err = new Error(
        "PayPal payment verification is not configured (set PAYPAL_CLIENT_SECRET)"
      );
      err.statusCode = 503;
      throw err;
    }
    if (!skipVerify) {
      const err = new Error(
        "PayPal verification requires PAYPAL_CLIENT_SECRET, or set PAYPAL_SKIP_VERIFY=true for local development only"
      );
      err.statusCode = 400;
      throw err;
    }
    dbgServer(
      "PayPal verify skipped (PAYPAL_SKIP_VERIFY) — not for production use"
    );
    return { skipped: true };
  }

  const token = await getAccessToken();
  const base = getPayPalApiBase();
  const res = await fetch(`${base}/v2/checkout/orders/${paypalOrderId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    dbgError("PayPal order fetch failed: %s %s", res.status, text.slice(0, 300));
    const err = new Error("Unable to verify payment with PayPal");
    err.statusCode = 502;
    throw err;
  }

  const payload = await res.json();
  const {
    customId,
    amountValue,
    currency,
    status: captureStatus,
    orderStatus,
  } = extractCaptureAndCustom(payload);

  if (orderStatus !== "COMPLETED") {
    const err = new Error(`PayPal order not completed (status: ${orderStatus})`);
    err.statusCode = 400;
    throw err;
  }

  if (captureStatus && captureStatus !== "COMPLETED") {
    const err = new Error(`PayPal capture not completed (status: ${captureStatus})`);
    err.statusCode = 400;
    throw err;
  }

  if (!Number.isFinite(amountValue)) {
    const err = new Error("PayPal response missing captured amount");
    err.statusCode = 502;
    throw err;
  }

  if (currency !== "USD") {
    const err = new Error(`Unexpected PayPal currency: ${currency}`);
    err.statusCode = 400;
    throw err;
  }

  const expected = roundMoney(expectedTotalUsd);
  if (Math.abs(amountValue - expected) > 0.02) {
    const err = new Error("PayPal amount does not match order total");
    err.statusCode = 400;
    throw err;
  }

  if (!customId || customId !== String(shopOrderId).trim()) {
    const err = new Error("PayPal order does not match this shop order");
    err.statusCode = 400;
    throw err;
  }

  return {
    skipped: false,
    paypalPayload: payload,
  };
}

function headerValue(headers, name) {
  const key = name.toLowerCase();
  const v = headers[key];
  if (typeof v === "string") {
    return v;
  }
  if (Array.isArray(v) && typeof v[0] === "string") {
    return v[0];
  }
  return "";
}

/**
 * Verifies a PayPal webhook using POST /v1/notifications/verify-webhook-signature.
 * @param {import("http").IncomingHttpHeaders} headers - Request headers (lowercase keys)
 * @param {object} webhookEvent - Parsed JSON body
 * @param {string} webhookId - PayPal dashboard Webhook ID
 */
export async function verifyPayPalWebhookEvent(headers, webhookEvent, webhookId) {
  let token;
  try {
    token = await getAccessToken();
  } catch (e) {
    dbgError("PayPal webhook verify: token error: %s", e?.message || e);
    return false;
  }
  if (!token) {
    dbgError("PayPal webhook verify: missing credentials for access token");
    return false;
  }

  const base = getPayPalApiBase();
  const payload = {
    auth_algo: headerValue(headers, "paypal-auth-algo"),
    cert_url: headerValue(headers, "paypal-cert-url"),
    transmission_id: headerValue(headers, "paypal-transmission-id"),
    transmission_sig: headerValue(headers, "paypal-transmission-sig"),
    transmission_time: headerValue(headers, "paypal-transmission-time"),
    webhook_id: webhookId,
    webhook_event: webhookEvent,
  };

  if (!payload.transmission_id || !payload.transmission_sig || !payload.webhook_event) {
    return false;
  }

  const res = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    dbgError("PayPal verify-webhook-signature failed: %s %j", res.status, data);
    return false;
  }

  return data.verification_status === "SUCCESS";
}
