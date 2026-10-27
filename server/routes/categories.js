import { Router } from "express";
import { z } from "zod";
import { db, nowIso } from "../db.js";
import { httpError } from "../http.js";
import { requireAdmin, requireAuth } from "../auth.js";
import { randomId } from "../security.js";
import { logAudit } from "../audit.js";

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

function listCategories(admin) {
  return db
    .prepare(
      `SELECT c.id, c.name, c.description, c.active,
              c.created_at AS createdAt, c.updated_at AS updatedAt,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS productCount,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS activeProductCount
       FROM categories c
       ${admin ? "" : "WHERE c.active = 1"}
       ORDER BY c.name ASC`,
    )
    .all()
    .map((row) => ({ ...row, active: Boolean(row.active) }));
}

categoriesRouter.get("/", (req, res) => {
  res.json({ items: listCategories(req.user.role === "admin") });
});

const categorySchema = z.object({
  name: z.string().trim().min(2, "Category name is required.").max(60),
  description: z.string().trim().max(240).optional().or(z.literal("")),
  active: z.boolean().optional().default(true),
});

categoriesRouter.post("/", requireAdmin, (req, res, next) => {
  try {
    const parsed = categorySchema.safeParse(req.body ?? {});
    if (!parsed.success) throw httpError(400, parsed.error.issues[0]?.message ?? "Invalid category.");
    const { name, description, active } = parsed.data;
    const duplicate = db.prepare("SELECT 1 FROM categories WHERE lower(name) = lower(?)").get(name);
    if (duplicate) throw httpError(409, "A category with that name already exists.");

    const id = randomId();
    const ts = nowIso();
    db.prepare(
      `INSERT INTO categories (id, name, description, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, name, description || null, active ? 1 : 0, ts, ts);

    logAudit({
      userId: req.user.id,
      action: "category.create",
      entity: "category",
      entityId: id,
      description: `Created category ${name}`,
      createdAt: ts,
    });
    res.status(201).json(listCategories(true).find((c) => c.id === id));
  } catch (error) {
    next(error);
  }
});

categoriesRouter.put("/:id", requireAdmin, (req, res, next) => {
  try {
    const id = req.params.id;
    const existing = db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
    if (!existing) throw httpError(404, "Category not found.");

    const parsed = categorySchema.safeParse(req.body ?? {});
    if (!parsed.success) throw httpError(400, parsed.error.issues[0]?.message ?? "Invalid category.");
    const { name, description, active } = parsed.data;

    const duplicate = db.prepare("SELECT 1 FROM categories WHERE id != ? AND lower(name) = lower(?)").get(id, name);
    if (duplicate) throw httpError(409, "A category with that name already exists.");

    const ts = nowIso();
    db.prepare(`UPDATE categories SET name = ?, description = ?, active = ?, updated_at = ? WHERE id = ?`).run(
      name,
      description || null,
      active ? 1 : 0,
      ts,
      id,
    );

    logAudit({
      userId: req.user.id,
      action: active === Boolean(existing.active) ? "category.update" : active ? "category.reactivate" : "category.deactivate",
      entity: "category",
      entityId: id,
      description: `Updated category ${name}`,
      meta: { active },
      createdAt: ts,
    });
    res.json(listCategories(true).find((c) => c.id === id));
  } catch (error) {
    next(error);
  }
});
