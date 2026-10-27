import { Router } from "express";
import { z } from "zod";
import { db, nowIso } from "../db.js";
import { httpError, intParam, strParam } from "../http.js";
import { requireAdmin, requireAuth } from "../auth.js";
import { randomId } from "../security.js";
import { logAudit } from "../audit.js";

export const productsRouter = Router();
productsRouter.use(requireAuth);

const PRODUCT_SELECT = `
  SELECT p.id, p.sku, p.barcode, p.name, p.category_id AS categoryId,
         c.name AS categoryName, p.cost_price AS costPrice, p.price,
         p.stock, p.min_stock AS minStock, p.unit, p.description,
         p.active, p.created_at AS createdAt, p.updated_at AS updatedAt
  FROM products p JOIN categories c ON c.id = p.category_id
`;

function shape(row, admin) {
  if (!row) return null;
  const result = { ...row, active: Boolean(row.active) };
  if (!admin) delete result.costPrice;
  return result;
}

productsRouter.get("/", (req, res, next) => {
  try {
    const admin = req.user.role === "admin";
    const page = intParam(req.query.page, 1);
    const pageSize = intParam(req.query.pageSize, 24, 5, 100);
    const search = strParam(req.query.search);
    const categoryId = strParam(req.query.categoryId);
    const status = strParam(req.query.status);
    const barcode = strParam(req.query.barcode);
    const lowStock = strParam(req.query.lowStock) === "1";
    const outOfStock = strParam(req.query.outOfStock) === "1";

    const conditions = [];
    const params = [];

    if (!admin) {
      conditions.push("p.active = 1");
    } else if (status === "active") {
      conditions.push("p.active = 1");
    } else if (status === "inactive") {
      conditions.push("p.active = 0");
    }

    if (categoryId) {
      conditions.push("p.category_id = ?");
      params.push(categoryId);
    }
    if (search) {
      conditions.push("(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (barcode) {
      conditions.push("p.barcode = ?");
      params.push(barcode);
    }
    if (lowStock) conditions.push("p.stock <= p.min_stock AND p.stock > 0");
    if (outOfStock) conditions.push("p.stock <= 0");

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const total = Number(db.prepare(`SELECT COUNT(*) AS c FROM products p ${where}`).get(...params).c);

    const sortKey = strParam(req.query.sortKey, "name");
    const sortDir = strParam(req.query.sortDir, "asc") === "desc" ? "DESC" : "ASC";
    const sortMap = {
      name: "p.name",
      price: "p.price",
      costPrice: "p.cost_price",
      stock: "p.stock",
      updatedAt: "p.updated_at",
      sku: "p.sku",
    };
    const orderBy = sortMap[sortKey] ?? "p.name";

    const rows = db
      .prepare(
        `${PRODUCT_SELECT} ${where} ORDER BY ${orderBy} ${sortDir} LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, (page - 1) * pageSize);

    res.json({
      items: rows.map((row) => shape(row, admin)),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    next(error);
  }
});

productsRouter.get("/:id", (req, res, next) => {
  try {
    const row = db.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).get(req.params.id);
    if (!row) throw httpError(404, "Product not found.");
    if (req.user.role !== "admin" && !row.active) throw httpError(404, "Product not found.");
    res.json(shape(row, req.user.role === "admin"));
  } catch (error) {
    next(error);
  }
});

const productBaseSchema = {
  name: z.string().trim().min(2, "Product name is required.").max(120),
  sku: z
    .string()
    .trim()
    .min(2, "SKU is required.")
    .max(40)
    .regex(/^[A-Za-z0-9._-]+$/, "SKU may only contain letters, numbers, dots, dashes and underscores."),
  barcode: z.string().trim().max(40).optional().or(z.literal("")),
  categoryId: z.string().min(1, "Select a category."),
  costPrice: z.number().int("Cost price must be a whole TZS amount.").min(0),
  price: z.number().int("Selling price must be a whole TZS amount.").positive("Selling price must be greater than zero."),
  minStock: z.number().int().min(0).max(1000000),
  unit: z.string().trim().max(30).optional().or(z.literal("")),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  active: z.boolean().optional().default(true),
};

const createSchema = z.object({
  ...productBaseSchema,
  stock: z.number().int().min(0).max(10000000).optional().default(0),
});

const updateSchema = z.object(productBaseSchema);

function validateCategory(categoryId) {
  const category = db.prepare("SELECT id FROM categories WHERE id = ?").get(categoryId);
  if (!category) throw httpError(400, "Selected category does not exist.");
}

function validateUnique({ sku, barcode, excludeId = null }) {
  const dupSku = db
    .prepare(`SELECT 1 FROM products WHERE lower(sku) = lower(?) ${excludeId ? "AND id != ?" : ""}`)
    .get(...(excludeId ? [sku, excludeId] : [sku]));
  if (dupSku) throw httpError(409, "A product with that SKU already exists.");
  if (barcode) {
    const dupBarcode = db
      .prepare(`SELECT 1 FROM products WHERE barcode = ? ${excludeId ? "AND id != ?" : ""}`)
      .get(...(excludeId ? [barcode, excludeId] : [barcode]));
    if (dupBarcode) throw httpError(409, "A product with that barcode already exists.");
  }
}

productsRouter.post("/", requireAdmin, (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw httpError(400, parsed.error.issues[0]?.message ?? "Invalid product.");
    const data = parsed.data;
    validateCategory(data.categoryId);
    validateUnique({ sku: data.sku, barcode: data.barcode });

    const id = randomId();
    const ts = nowIso();
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(
        `INSERT INTO products
          (id, sku, barcode, name, category_id, cost_price, price, stock, min_stock, unit, description, image_url, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      ).run(
        id,
        data.sku,
        data.barcode || null,
        data.name,
        data.categoryId,
        data.costPrice,
        data.price,
        data.stock,
        data.minStock,
        data.unit || null,
        data.description || null,
        data.active ? 1 : 0,
        ts,
        ts,
      );

      if (data.stock > 0) {
        db.prepare(
          `INSERT INTO inventory_movements (id, product_id, qty_change, type, reason, reference, user_id, created_at)
           VALUES (?, ?, ?, 'stock_in', 'Opening stock', NULL, ?, ?)`,
        ).run(randomId(), id, data.stock, req.user.id, ts);
      }

      logAudit({
        userId: req.user.id,
        action: "product.create",
        entity: "product",
        entityId: id,
        description: `Created product ${data.name} (${data.sku})`,
        meta: { sku: data.sku, price: data.price, stock: data.stock },
        createdAt: ts,
      });
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    const row = db.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).get(id);
    res.status(201).json(shape(row, true));
  } catch (error) {
    next(error);
  }
});

productsRouter.put("/:id", requireAdmin, (req, res, next) => {
  try {
    const id = req.params.id;
    const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
    if (!existing) throw httpError(404, "Product not found.");

    const parsed = updateSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw httpError(400, parsed.error.issues[0]?.message ?? "Invalid product.");
    const data = parsed.data;
    validateCategory(data.categoryId);
    validateUnique({ sku: data.sku, barcode: data.barcode, excludeId: id });

    const ts = nowIso();
    db.prepare(
      `UPDATE products SET sku = ?, barcode = ?, name = ?, category_id = ?, cost_price = ?, price = ?,
         min_stock = ?, unit = ?, description = ?, active = ?, updated_at = ? WHERE id = ?`,
    ).run(
      data.sku,
      data.barcode || null,
      data.name,
      data.categoryId,
      data.costPrice,
      data.price,
      data.minStock,
      data.unit || null,
      data.description || null,
      data.active ? 1 : 0,
      ts,
      id,
    );

    const statusChanged = Boolean(existing.active) !== data.active;
    logAudit({
      userId: req.user.id,
      action: statusChanged ? (data.active ? "product.reactivate" : "product.deactivate") : "product.update",
      entity: "product",
      entityId: id,
      description: statusChanged
        ? `${data.active ? "Reactivated" : "Deactivated"} product ${data.name}`
        : `Updated product ${data.name} (${data.sku})`,
      meta: { sku: data.sku, price: data.price, active: data.active },
      createdAt: ts,
    });

    const row = db.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).get(id);
    res.json(shape(row, true));
  } catch (error) {
    next(error);
  }
});

productsRouter.delete("/:id", requireAdmin, (req, res, next) => {
  try {
    const id = req.params.id;
    const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
    if (!existing) throw httpError(404, "Product not found.");
    if (!existing.active) return res.json({ ok: true, alreadyInactive: true });

    const ts = nowIso();
    db.prepare("UPDATE products SET active = 0, updated_at = ? WHERE id = ?").run(ts, id);
    logAudit({
      userId: req.user.id,
      action: "product.deactivate",
      entity: "product",
      entityId: id,
      description: `Deactivated product ${existing.name} (${existing.sku})`,
      createdAt: ts,
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
