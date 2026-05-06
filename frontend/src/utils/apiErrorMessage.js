/**
 * Normalizes API error payloads from Express / express-rate-limit into a string.
 * Handles nested shapes like `{ message: { message: "..." } }` and plain string bodies.
 */
export function normalizeApiMessage(message) {
  if (message == null) {
    return "";
  }
  if (typeof message === "string") {
    return message;
  }
  if (typeof message === "object") {
    const inner = message.message;
    if (typeof inner === "string") {
      return inner;
    }
    if (inner != null && typeof inner === "object") {
      return normalizeApiMessage(inner);
    }
  }
  return "";
}

export function getApiErrorMessage(error, fallback = "Something went wrong") {
  const data = error?.response?.data;
  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }
  const fromMessage = normalizeApiMessage(data?.message);
  if (fromMessage) {
    return fromMessage;
  }
  const msg = error?.message;
  if (typeof msg === "string" && msg.trim()) {
    return msg.trim();
  }
  return fallback;
}
