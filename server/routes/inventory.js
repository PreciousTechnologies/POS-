import { Router } from "express";
import { z } from "zod";
import { db, nowIso } from "../db.js";
import { httpError, intParam, strParam } from "../http.js";
import { requireAdmin, requireAuth } from "../auth.js";
import { randomId } from "../security.js";
import { logAudit } from "../audit.js";

export const inventoryRouter = Router();
inventoryRouter.use(requireAuth, requireAdmin);

inventoryRouter.get("/summary", (_req, res) => {
  const totals = db
    .prepare(
      `SELECT
        COUNT(*) AS activeProducts,
        COALESCE(SUM(stock), 0) AS units,
        COALESCE(SUM(stock * cost_price), 0) AS costValuation,
        COALESCE(SUM(stock * price), 0) AS retailValuation,
        SUM(CASE WHEN stock <= 0 THEN 1 ELSE 0 END) AS outOfStock,
        SUM(CASE WHEN stock > 0 AND stock <= min_stock THEN 1 ELSE 0 END) AS lowStock
       FROM products WHERE active = 1`,
    )
    .get();
  res.json(totals);
});

inventoryRouter.get("/movements", (req, res) => {
  const page = intParam(req.query.page, 1);
  const pageSize = intParam(req.query.pageSize, 12, 5, 100);
  const search = strParam(req.query.search);
  const type = strParam(req.query.type);

  const conditions = [];
  const params = [];
  if (search) {
    conditions.push("(p.name LIKE ? OR p.sku LIKE ? OR m.reference LIKE ? OR m.reason LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (type) {
    conditions.push("m.type = ?");
    params.push(type);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const total = Number(
    db
      .prepare(`SELECT COUNT(*) AS c FROM inventory_movements m JOIN products p ON p.id = m.product_id ${where}`)
      .get(...params).c,
  );

  const items = db
    .prepare(
      `SELECT m.id, m.product_id AS productId, p.name AS productName, p.sku,
              m.qty_change AS qtyChange, m.type, m.reason, m.reference,
              u.name AS userName, m.created_at AS createdAt
       FROM inventory_movements m
       JOIN products p ON p.id = m.product_id
       LEFT JOIN users u ON u.id = m.user_id
       ${where}
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize);

  res.json({ items, total, page, pageSize });
});

inventoryRouter.get("/alerts", (_req, res) => {
  const base = `
    SELECT p.id, p.sku, p.name, p.stock, p.min_stock AS minStock, c.name AS categoryName
    FROM products p JOIN categories c ON c.id = p.category_id
    WHERE p.active = 1
  `;
  const lowStock = db
    .prepare(`${base} AND p.stock > 0 AND p.stock <= p.min_stock ORDER BY p.stock ASC, p.name ASC LIMIT 50`)
    .all();
  const outOfStock = db
    .prepare(`${base} AND p.stock <= 0 ORDER BY p.name ASC LIMIT 50`)
    .all();
  res.json({ lowStock, outOfStock });
});

const stockInSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().positive("Quantity must be a positive whole number.").max(10000000),
  reason: z.string().trim().min(3, "Provide a reason for the stock movement.").max(240),
  reference: z.string().trim().max(60).optional().or(z.literal("")),
});

inventoryRouter.post("/stock-in", (req, res, next) => {
  try {
    const parsed = stockInSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw httpError(400, parsed.error.issues[0]?.message ?? "Invalid stock entry.");
    const { productId, qty, reason, reference } = parsed.data;
    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
    if (!product) throw httpError(404, "Product not found.");
    if (!product.active) throw httpError(400, "Reactivate this product before adding stock.");

    const ts = nowIso();
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?").run(qty, ts, productId);
      db.prepare(
        `INSERT INTO inventory_movements (id, product_id, qty_change, type, reason, reference, user_id, created_at)
         VALUES (?, ?, ?, 'stock_in', ?, ?, ?, ?)`,
      ).run(randomId(), productId, qty, reason, reference || null, req.user.id, ts);
      logAudit({
        userId: req.user.id,
        action: "inventory.stock_in",
        entity: "product",
        entityId: productId,
        description: `Added ${qty} unit(s) of ${product.name} — ${reason}`,
        meta: { qty, reference: reference || null },
        createdAt: ts,
      });
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    const updated = db
      .prepare(
        `SELECT p.id, p.sku, p.name, p.stock, p.min_stock AS minStock, c.name AS categoryName
         FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?`,
      )
      .get(productId);
    res.status(201).json(updated);
  } catch (error) {
    next(error);
  }
});

const adjustSchema = z.object({
  productId: z.string().min(1),
  qtyChange: z.number().int("Adjustment must be a whole number."),
  reason: z.string().trim().min(3, "A reason is required for stock adjustments.").max(240),
});

inventoryRouter.post("/adjust", (req, res, next) => {
  try {
    const parsed = adjustSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw httpError(400, parsed.error.issues[0]?.message ?? "Invalid adjustment.");
    const { productId, qtyChange, reason } = parsed.data;
    if (qtyChange === 0) throw httpError(400, "Stock adjustment cannot be zero.");

    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
    if (!product) throw httpError(404, "Product not found.");
    const nextStock = product.stock + qtyChange;
    if (nextStock < 0) throw httpError(400, `Adjustment would leave negative stock (current: ${product.stock}).`);

    const ts = nowIso();
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("UPDATE products SET stock = ?, updated_at = ? WHERE id = ?").run(nextStock, ts, productId);
      db.prepare(
        `INSERT INTO inventory_movements (id, product_id, qty_change, type, reason, reference, user_id, created_at)
         VALUES (?, ?, ?, 'adjustment', ?, NULL, ?, ?)`,
      ).run(randomId(), productId, qtyChange, reason, req.user.id, ts);
      logAudit({
        userId: req.user.id,
        action: "inventory.adjust",
        entity: "product",
        entityId: productId,
        description: `Adjusted ${product.name} by ${qtyChange > 0 ? "+" : ""}${qtyChange} unit(s) — ${reason}`,
        meta: { from: product.stock, to: nextStock, reason },
        createdAt: ts,
      });
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    res.status(201).json({ id: productId, stock: nextStock });
  } catch (error) {
    next(error);
  }
});
