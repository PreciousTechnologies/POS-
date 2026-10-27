import { db, businessDate, nowIso, getSettingsRow, roundTzs } from "../db.js";
import { httpError, intParam, strParam } from "../http.js";
import { randomId, randomToken } from "../security.js";
import { logAudit } from "../audit.js";

const SALE_SELECT = `
  SELECT
    s.id,
    s.ref,
    s.cashier_id AS cashierId,
    u.name AS cashierName,
    s.subtotal,
    s.discount,
    s.total,
    s.cost_total AS costTotal,
    s.status,
    s.payment_method AS paymentMethod,
    s.amount_received AS amountReceived,
    s.change_due AS changeDue,
    s.customer_name AS customerName,
    s.note,
    s.business_date AS businessDate,
    s.created_at AS createdAt,
    s.voided_at AS voidedAt,
    s.refunded_amount AS refundedAmount,
    (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS itemCount,
    (SELECT COALESCE(SUM(si.qty), 0) FROM sale_items si WHERE si.sale_id = s.id) AS units
  FROM sales s
  JOIN users u ON u.id = s.cashier_id
`;

function saleRow(id) {
  return db.prepare(`${SALE_SELECT} WHERE s.id = ?`).get(id);
}

export function getSaleDetail(id, viewer) {
  const sale = saleRow(id);
  if (!sale) throw httpError(404, "Transaction not found.");
  if (viewer.role !== "admin" && sale.cashierId !== viewer.id) {
    throw httpError(403, "You can only open your own transactions.");
  }
  const items = db
    .prepare(
      `SELECT id, product_id AS productId, name, sku, qty, unit_price AS unitPrice,
              discount, line_total AS lineTotal, unit_cost AS unitCost
       FROM sale_items WHERE sale_id = ? ORDER BY rowid ASC`,
    )
    .all(id);
  const payments = db
    .prepare(
      `SELECT id, method, amount, status, reference, simulated, created_at AS createdAt
       FROM payments WHERE sale_id = ? ORDER BY created_at ASC`,
    )
    .all(id)
    .map((p) => ({ ...p, simulated: Boolean(p.simulated) }));
  const refunds = db
    .prepare(
      `SELECT r.id, r.amount, r.cost_amount AS costAmount, r.reason, r.restock,
              r.business_date AS businessDate, r.created_at AS createdAt, u.name AS userName
       FROM refunds r JOIN users u ON u.id = r.user_id
       WHERE r.sale_id = ? ORDER BY r.created_at DESC`,
    )
    .all(id)
    .map((r) => ({ ...r, restock: Boolean(r.restock) }));
  return { ...sale, items, payments, refunds };
}

export function listSales(user, query = {}) {
  const today = businessDate(new Date(), getSettingsRow()?.timezone ?? "Africa/Dar_es_Salaam");
  const from = strParam(query.from, today.slice(0, 8) + "01");
  const to = strParam(query.to, today);
  const page = intParam(query.page, 1);
  const pageSize = intParam(query.pageSize, 12, 5, 100);
  const search = strParam(query.search);
  const method = strParam(query.method);
  const status = strParam(query.status);
  const cashierId = user.role === "cashier" ? user.id : strParam(query.cashierId);

  const conditions = ["s.business_date >= ?", "s.business_date <= ?"];
  const params = [from, to];

  if (cashierId) {
    conditions.push("s.cashier_id = ?");
    params.push(cashierId);
  }
  if (method) {
    conditions.push("s.payment_method = ?");
    params.push(method);
  }
  if (status) {
    conditions.push("s.status = ?");
    params.push(status);
  }
  if (search) {
    conditions.push("(s.ref LIKE ? OR s.customer_name LIKE ? OR u.name LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = conditions.join(" AND ");
  const total = Number(db.prepare(`SELECT COUNT(*) AS c FROM sales s JOIN users u ON u.id = s.cashier_id WHERE ${where}`).get(...params).c);

  const sortKey = strParam(query.sortKey, "createdAt");
  const sortDir = strParam(query.sortDir, "desc") === "asc" ? "ASC" : "DESC";
  const sortMap = {
    createdAt: "s.created_at",
    total: "s.total",
    ref: "s.ref",
    businessDate: "s.business_date",
  };
  const orderBy = sortMap[sortKey] ?? "s.created_at";

  const items = db
    .prepare(`${SALE_SELECT} WHERE ${where} ORDER BY ${orderBy} ${sortDir} LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize);

  return { items, total, page, pageSize };
}

export function checkout(user, payload) {
  const settings = getSettingsRow();
  const timezone = settings?.timezone ?? "Africa/Dar_es_Salaam";
  const date = businessDate(new Date(), timezone);
  const createdAt = nowIso();

  const merged = new Map();
  for (const line of payload.items) {
    const qty = Number(line.qty);
    if (!Number.isInteger(qty) || qty <= 0) throw httpError(400, "Quantities must be whole positive numbers.");
    merged.set(line.productId, (merged.get(line.productId) ?? 0) + qty);
  }

  const existing = db.prepare("SELECT id FROM sales WHERE idempotency_key = ?").get(payload.idempotencyKey);
  if (existing) {
    if (user.role !== "admin") {
      const row = db.prepare("SELECT cashier_id AS cashierId FROM sales WHERE id = ?").get(existing.id);
      if (row?.cashierId !== user.id) throw httpError(409, "This checkout reference was already used.");
    }
    return { ...getSaleDetail(existing.id, user), duplicate: true };
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    const products = [];
    for (const [productId, qty] of merged) {
      const product = db
        .prepare(
          `SELECT id, name, sku, price, cost_price AS costPrice, stock, active
           FROM products WHERE id = ?`,
        )
        .get(productId);
      if (!product) throw httpError(409, "One of the products is no longer available. Remove it and try again.");
      if (!product.active) throw httpError(409, `${product.name} is inactive and cannot be sold.`);
      if (product.stock < qty) {
        throw httpError(409, `Not enough stock for ${product.name}. Only ${product.stock} left.`, {
          code: "INSUFFICIENT_STOCK",
          productId,
          name: product.name,
          available: product.stock,
          requested: qty,
        });
      }
      products.push({ product, qty });
    }

    const subtotal = products.reduce((sum, line) => sum + line.product.price * line.qty, 0);
    const requestedDiscount = Math.max(0, Number(payload.discount ?? 0));
    if (!Number.isInteger(requestedDiscount)) throw httpError(400, "Discount must be a whole TZS amount.");
    if (requestedDiscount > subtotal) throw httpError(400, "Discount cannot be greater than the subtotal.");

    if (requestedDiscount > 0 && user.role !== "admin") {
      const pct = Number(settings?.discount_limit_pct ?? 0);
      const maxDiscount = Math.floor((subtotal * pct) / 100);
      if (!settings?.allow_discounts || requestedDiscount > maxDiscount) {
        throw httpError(403, `Cashiers may discount up to ${pct}% of the subtotal. Ask an administrator for a larger discount.`);
      }
    }

    const total = subtotal - requestedDiscount;
    if (total <= 0) throw httpError(400, "The sale total must be greater than zero.");

    const method = payload.paymentMethod;
    if (!["cash", "mobile_money", "card"].includes(method)) throw httpError(400, "Unsupported payment method.");

    let amountReceived = total;
    let changeDue = 0;
    let paymentStatus = "simulated";
    let simulated = 1;
    let paymentReference = null;

    if (method === "cash") {
      amountReceived = Number(payload.amountReceived);
      if (!Number.isFinite(amountReceived) || !Number.isInteger(amountReceived)) {
        throw httpError(400, "Enter the amount of cash received.");
      }
      if (amountReceived < total) {
        throw httpError(400, `Cash received is short by TZS ${(total - amountReceived).toLocaleString()}.`);
      }
      changeDue = amountReceived - total;
      paymentStatus = "paid";
      simulated = 0;
    } else {
      const provider =
        method === "mobile_money" ? (payload.mobileProvider || "Mobile money") : payload.cardProvider || "Card terminal";
      paymentReference = `SIM-${String(provider).replace(/[^A-Za-z0-9]/g, "").toUpperCase()}-${randomToken(3)}`;
    }

    const costTotal = products.reduce((sum, line) => sum + line.product.costPrice * line.qty, 0);

    let ref = "";
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = `POS-${date.replaceAll("-", "")}-${randomToken(2)}`;
      if (!db.prepare("SELECT 1 FROM sales WHERE ref = ?").get(candidate)) {
        ref = candidate;
        break;
      }
    }
    if (!ref) throw httpError(500, "Could not generate a transaction reference. Please retry.");

    const saleId = randomId();
    db.prepare(
      `INSERT INTO sales
        (id, ref, cashier_id, subtotal, discount, total, cost_total, status, payment_method,
         amount_received, change_due, customer_name, note, idempotency_key, business_date, created_at, voided_at, refunded_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0)`,
    ).run(
      saleId,
      ref,
      user.id,
      subtotal,
      requestedDiscount,
      total,
      costTotal,
      method,
      amountReceived,
      changeDue,
      payload.customerName?.trim() || "Walk-in customer",
      payload.note?.trim() || null,
      payload.idempotencyKey,
      date,
      createdAt,
    );

    const insertItem = db.prepare(
      `INSERT INTO sale_items (id, sale_id, product_id, name, sku, qty, unit_price, discount, line_total, unit_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    );
    const decrementStock = db.prepare("UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ? AND stock >= ?");
    const insertMovement = db.prepare(
      `INSERT INTO inventory_movements (id, product_id, qty_change, type, reason, reference, user_id, created_at)
       VALUES (?, ?, ?, 'sale', 'Sale completed', ?, ?, ?)`,
    );

    for (const { product, qty } of products) {
      insertItem.run(
        randomId(),
        saleId,
        product.id,
        product.name,
        product.sku,
        qty,
        product.price,
        product.price * qty,
        product.costPrice,
      );
      const result = decrementStock.run(qty, createdAt, product.id, qty);
      if (result.changes !== 1) {
        throw httpError(409, `Stock for ${product.name} changed while checking out. Please review the cart.`, {
          code: "INSUFFICIENT_STOCK",
          productId: product.id,
          name: product.name,
          available: Math.max(0, product.stock - qty),
          requested: qty,
        });
      }
      insertMovement.run(randomId(), product.id, -qty, ref, user.id, createdAt);
    }

    db.prepare(
      `INSERT INTO payments (id, sale_id, method, amount, status, reference, simulated, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(randomId(), saleId, method, total, paymentStatus, paymentReference, simulated, createdAt);

    logAudit({
      userId: user.id,
      action: "sale.create",
      entity: "sale",
      entityId: saleId,
      description: `Completed ${formatMethod(method)} sale ${ref} for TZS ${total.toLocaleString()}`,
      meta: { ref, total, method },
      createdAt,
    });

    db.exec("COMMIT");
    return { ...getSaleDetail(saleId, user), duplicate: false };
  } catch (error) {
    db.exec("ROLLBACK");
    if (String(error?.message ?? "").includes("UNIQUE constraint failed: sales.idempotency_key")) {
      const row = db.prepare("SELECT id FROM sales WHERE idempotency_key = ?").get(payload.idempotencyKey);
      if (row) return { ...getSaleDetail(row.id, user), duplicate: true };
    }
    throw error;
  }
}

export function voidSale(user, id) {
  const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(id);
  if (!sale) throw httpError(404, "Transaction not found.");
  if (sale.status === "voided") throw httpError(400, "This transaction is already voided.");
  if (sale.refunded_amount > 0 || sale.status === "refunded" || sale.status === "partially_refunded") {
    throw httpError(400, "Transactions with refunds cannot be voided. Record a refund instead.");
  }

  const voidedAt = nowIso();
  db.exec("BEGIN IMMEDIATE");
  try {
    const items = db.prepare("SELECT product_id AS productId, name, qty FROM sale_items WHERE sale_id = ?").all(id);
    const restore = db.prepare("UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?");
    const movement = db.prepare(
      `INSERT INTO inventory_movements (id, product_id, qty_change, type, reason, reference, user_id, created_at)
       VALUES (?, ?, ?, 'void', 'Voided sale — stock restored', ?, ?, ?)`,
    );
    for (const item of items) {
      restore.run(item.qty, voidedAt, item.productId);
      movement.run(randomId(), item.productId, item.qty, sale.ref, user.id, voidedAt);
    }
    db.prepare("UPDATE sales SET status = 'voided', voided_at = ? WHERE id = ?").run(voidedAt, id);
    db.prepare("UPDATE payments SET status = 'voided' WHERE sale_id = ?").run(id);
    logAudit({
      userId: user.id,
      action: "sale.void",
      entity: "sale",
      entityId: id,
      description: `Voided sale ${sale.ref} and restored ${items.length} line(s) to stock`,
      meta: { ref: sale.ref, total: sale.total },
      createdAt: voidedAt,
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getSaleDetail(id, user);
}

export function refundSale(user, id, payload) {
  const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(id);
  if (!sale) throw httpError(404, "Transaction not found.");
  if (sale.status === "voided") throw httpError(400, "A voided transaction cannot be refunded.");
  if (sale.status === "refunded") throw httpError(400, "This transaction has already been fully refunded.");

  const amount = Number(payload.amount);
  if (!Number.isInteger(amount) || amount <= 0) throw httpError(400, "Refund amount must be a positive whole TZS amount.");
  const reason = String(payload.reason ?? "").trim();
  if (reason.length < 3) throw httpError(400, "Provide a reason for the refund (minimum 3 characters).");

  const alreadyRefunded = Number(sale.refunded_amount ?? 0);
  const remaining = sale.total - alreadyRefunded;
  if (amount > remaining) throw httpError(400, `Refund cannot exceed the remaining TZS ${remaining.toLocaleString()}.`);

  const isFull = amount === remaining;
  const restock = Boolean(payload.restock);
  if (restock && !isFull) throw httpError(400, "Stock can only be restored for a full refund.");

  const previousCost = Number(
    db.prepare("SELECT COALESCE(SUM(cost_amount), 0) AS c FROM refunds WHERE sale_id = ?").get(id).c,
  );
  const costAmount = isFull ? Math.max(0, sale.cost_total - previousCost) : Math.round((sale.cost_total * amount) / sale.total);

  const createdAt = nowIso();
  const date = businessDate(new Date(), getSettingsRow()?.timezone ?? "Africa/Dar_es_Salaam");

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `INSERT INTO refunds (id, sale_id, amount, cost_amount, reason, restock, user_id, business_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(randomId(), id, amount, costAmount, reason, restock ? 1 : 0, user.id, date, createdAt);

    db.prepare("UPDATE sales SET status = ?, refunded_amount = refunded_amount + ? WHERE id = ?").run(
      isFull ? "refunded" : "partially_refunded",
      amount,
      id,
    );

    if (restock) {
      const items = db.prepare("SELECT product_id AS productId, qty FROM sale_items WHERE sale_id = ?").all(id);
      const restore = db.prepare("UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?");
      const movement = db.prepare(
        `INSERT INTO inventory_movements (id, product_id, qty_change, type, reason, reference, user_id, created_at)
         VALUES (?, ?, ?, 'return', 'Full refund — stock restored', ?, ?, ?)`,
      );
      for (const item of items) {
        restore.run(item.qty, createdAt, item.productId);
        movement.run(randomId(), item.productId, item.qty, sale.ref, user.id, createdAt);
      }
    }

    logAudit({
      userId: user.id,
      action: "sale.refund",
      entity: "sale",
      entityId: id,
      description: `${isFull ? "Full" : "Partial"} refund of TZS ${amount.toLocaleString()} on ${sale.ref}: ${reason}`,
      meta: { ref: sale.ref, amount, restock, isFull },
      createdAt,
    });

    if (isFull) {
      db.prepare("UPDATE payments SET status = 'refunded' WHERE sale_id = ?").run(id);
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return getSaleDetail(id, user);
}

export function formatMethod(method) {
  if (method === "cash") return "cash";
  if (method === "mobile_money") return "mobile money";
  if (method === "card") return "card";
  return method;
}
