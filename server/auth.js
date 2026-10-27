import fs from "node:fs";
import crypto from "node:crypto";
import { db } from "./db.js";
import { SECRET_PATH } from "./paths.js";
import { httpError } from "./http.js";

function loadSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  try {
    const existing = fs.readFileSync(SECRET_PATH, "utf8").trim();
    if (existing) return existing;
  } catch {
    /* file does not exist yet */
  }
  const secret = crypto.randomBytes(48).toString("hex");
  fs.writeFileSync(SECRET_PATH, secret, { encoding: "utf8", mode: 0o600 });
  return secret;
}

const SECRET = loadSecret();
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

export function signToken(user) {
  const payload = {
    sub: user.id,
    role: user.role,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload?.sub || !payload?.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function serializeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email,
    role: row.role,
    active: Boolean(row.active),
    createdAt: row.created_at,
  };
}

export function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const payload = verifyToken(token);
    if (!payload) throw httpError(401, "Your session has expired. Please sign in again.");
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.sub);
    if (!row) throw httpError(401, "Account not found. Please sign in again.");
    if (!row.active) throw httpError(403, "This account has been deactivated. Contact an administrator.");
    req.user = serializeUser(row);
    req.token = token;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== "admin") {
    return next(httpError(403, "Administrator access is required for this action."));
  }
  next();
}

export function requireCashierOrAdmin(req, _res, next) {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "cashier")) {
    return next(httpError(403, "You do not have access to this action."));
  }
  next();
}

/** Load a user row and throw if missing/inactive. */
export function loadActiveUser(id) {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!row || !row.active) throw httpError(401, "Account is not active.");
  return serializeUser(row);
}
