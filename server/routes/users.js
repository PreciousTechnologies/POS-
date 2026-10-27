import { Router } from "express";
import { z } from "zod";
import { db, nowIso } from "../db.js";
import { httpError } from "../http.js";
import { requireAuth, requireAdmin, serializeUser } from "../auth.js";
import { hashPassword, randomId } from "../security.js";
import { logAudit } from "../audit.js";

export const usersRouter = Router();
usersRouter.use(requireAuth, requireAdmin);

const baseUser = {
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  email: z.string().trim().email("Enter a valid email address."),
  role: z.enum(["admin", "cashier"]),
};

const createSchema = z.object({
  ...baseUser,
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .max(30)
    .regex(/^[a-zA-Z0-9._-]+$/, "Username can only contain letters, numbers, dots, dashes and underscores."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  active: z.boolean().optional().default(true),
});

const updateSchema = z.object({
  ...baseUser,
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9._-]+$/),
  active: z.boolean(),
  password: z.string().min(6, "Password must be at least 6 characters.").optional().or(z.literal("")),
});

function listUsers() {
  return db
    .prepare(
      `SELECT id, username, name, email, role, active, created_at AS createdAt
       FROM users ORDER BY active DESC, name ASC`,
    )
    .all()
    .map(serializeUser);
}

usersRouter.get("/", (_req, res) => {
  res.json({ items: listUsers() });
});

usersRouter.post("/", (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw httpError(400, parsed.error.issues[0]?.message ?? "Invalid user details.");
    const data = parsed.data;
    const duplicate = db
      .prepare("SELECT 1 FROM users WHERE lower(username) = lower(?) OR lower(email) = lower(?)")
      .get(data.username, data.email);
    if (duplicate) throw httpError(409, "A user with that username or email already exists.");

    const id = randomId();
    const ts = nowIso();
    db.prepare(
      `INSERT INTO users (id, username, name, email, role, active, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, data.username, data.name, data.email, data.role, data.active ? 1 : 0, hashPassword(data.password), ts, ts);

    logAudit({
      userId: req.user.id,
      action: "user.create",
      entity: "user",
      entityId: id,
      description: `Created ${data.role} account for ${data.name}`,
      createdAt: ts,
    });

    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    res.status(201).json(serializeUser(row));
  } catch (error) {
    next(error);
  }
});

usersRouter.put("/:id", (req, res, next) => {
  try {
    const id = req.params.id;
    const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!existing) throw httpError(404, "User not found.");

    const parsed = updateSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw httpError(400, parsed.error.issues[0]?.message ?? "Invalid user details.");
    const data = parsed.data;

    if (existing.id === req.user.id && !data.active) {
      throw httpError(400, "You cannot deactivate your own account.");
    }
    if (existing.id === req.user.id && data.role !== "admin") {
      throw httpError(400, "You cannot remove your own administrator role.");
    }
    if (existing.role === "admin" && (data.role !== "admin" || !data.active)) {
      const activeAdmins = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1").get().c;
      if (Number(activeAdmins) <= 1) throw httpError(400, "At least one active administrator is required.");
    }

    const duplicate = db
      .prepare("SELECT 1 FROM users WHERE id != ? AND (lower(username) = lower(?) OR lower(email) = lower(?))")
      .get(id, data.username, data.email);
    if (duplicate) throw httpError(409, "A user with that username or email already exists.");

    const ts = nowIso();
    if (data.password) {
      db.prepare(
        `UPDATE users SET username = ?, name = ?, email = ?, role = ?, active = ?, password_hash = ?, updated_at = ? WHERE id = ?`,
      ).run(data.username, data.name, data.email, data.role, data.active ? 1 : 0, hashPassword(data.password), ts, id);
    } else {
      db.prepare(
        `UPDATE users SET username = ?, name = ?, email = ?, role = ?, active = ?, updated_at = ? WHERE id = ?`,
      ).run(data.username, data.name, data.email, data.role, data.active ? 1 : 0, ts, id);
    }

    logAudit({
      userId: req.user.id,
      action: data.active === Boolean(existing.active) ? "user.update" : data.active ? "user.reactivate" : "user.deactivate",
      entity: "user",
      entityId: id,
      description: `Updated account for ${data.name}${data.password ? " (password reset)" : ""}`,
      meta: { role: data.role, active: data.active, passwordReset: Boolean(data.password) },
      createdAt: ts,
    });

    res.json(serializeUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id)));
  } catch (error) {
    next(error);
  }
});
