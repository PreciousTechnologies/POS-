export function httpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details !== undefined) err.details = details;
  return err;
}

export function ok(res, data) {
  res.json(data);
}

/** Parse a positive integer query param with a fallback + clamp. */
export function intParam(value, fallback, min = 1, max = 10000) {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function strParam(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}
