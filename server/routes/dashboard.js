import { Router } from "express";
import { db, addDays, businessDate, getSettingsRow } from "../db.js";
import { httpError, strParam } from "../http.js";
import { requireAuth } from "../auth.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function resolveRange(query, defaultDays = 14) {
  const today = businessDate(new Date(), getSettingsRow()?.timezone ?? "Africa/Dar_es_Salaam");
  let from = strParam(query.from, addDays(today, -(defaultDays - 1)));
  let to = strParam(query.to, today);
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) throw httpError(400, "Dates must use the YYYY-MM-DD format.");
  if (from > to) [from, to] = [to, from];
  const span = Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 864e5);
  if (span > 370) throw httpError(400, "Date range cannot exceed 370 days.");
  return { from, to, today };
}

function rangeDates(from, to) {
  const dates = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

dashboardRouter.get("/", (req, res, next) => {
  try {
    const { from, to } = resolveRange(req.query, 14);
    const cashierId = req.user.role === "cashier" ? req.user.id : null;
    const scope = cashierId ? "AND s.cashier_id = ?" : "";
    const scopeParams = cashierId ? [cashierId] : [];

    const sales = db
      .prepare(
        `SELECT COUNT(*) AS transactions,
                COALESCE(SUM(total), 0) AS grossSales,
                COALESCE(SUM(discount), 0) AS discounts,
                COALESCE(SUM(cost_total), 0) AS costTotal
         FROM sales s
         WHERE s.status != 'voided' AND s.business_date BETWEEN ? AND ? ${scope}`,
      )
      .get(from, to, ...scopeParams);

    const units = Number(
      db
        .prepare(
          `SELECT COALESCE(SUM(si.qty), 0) AS units
           FROM sale_items si JOIN sales s ON s.id = si.sale_id
           WHERE s.status != 'voided' AND s.business_date BETWEEN ? AND ? ${scope}`,
        )
        .get(from, to, ...scopeParams).units,
    );

    const refunds = db
      .prepare(
        `SELECT COALESCE(SUM(r.amount), 0) AS amount, COALESCE(SUM(r.cost_amount), 0) AS cost,
                COUNT(*) AS count
         FROM refunds r JOIN sales s ON s.id = r.sale_id
         WHERE r.business_date BETWEEN ? AND ? ${cashierId ? "AND s.cashier_id = ?" : ""}`,
      )
      .get(from, to, ...scopeParams);

    const grossSales = Number(sales.grossSales);
    const costTotal = Number(sales.costTotal);
    const refundAmount = Number(refunds.amount);
    const netRevenue = grossSales - refundAmount;
    const profit = grossSales - costTotal - Number(refunds.cost);
    const transactions = Number(sales.transactions);

    const seriesRows = db
      .prepare(
        `SELECT s.business_date AS date, COALESCE(SUM(s.total), 0) AS revenue, COUNT(*) AS transactions
         FROM sales s
         WHERE s.status != 'voided' AND s.business_date BETWEEN ? AND ? ${scope}
         GROUP BY s.business_date ORDER BY s.business_date ASC`,
      )
      .all(from, to, ...scopeParams);
    const refundRows = db
      .prepare(
        `SELECT r.business_date AS date, COALESCE(SUM(r.amount), 0) AS refunds
         FROM refunds r JOIN sales s ON s.id = r.sale_id
         WHERE r.business_date BETWEEN ? AND ? ${cashierId ? "AND s.cashier_id = ?" : ""}
         GROUP BY r.business_date`,
      )
      .all(from, to, ...scopeParams);
    const refundMap = new Map(refundRows.map((row) => [row.date, Number(row.refunds)]));
    const seriesMap = new Map(seriesRows.map((row) => [row.date, row]));
    const series = rangeDates(from, to).map((date) => {
      const row = seriesMap.get(date);
      return {
        date,
        revenue: Number(row?.revenue ?? 0),
        transactions: Number(row?.transactions ?? 0),
        refunds: refundMap.get(date) ?? 0,
      };
    });

    const paymentMix = db
      .prepare(
        `SELECT p.method, COUNT(*) AS count, COALESCE(SUM(p.amount), 0) AS amount
         FROM payments p JOIN sales s ON s.id = p.sale_id
         WHERE s.status != 'voided' AND s.business_date BETWEEN ? AND ? ${scope}
         GROUP BY p.method ORDER BY amount DESC`,
      )
      .all(from, to, ...scopeParams);

    const bestSellers = db
      .prepare(
        `SELECT si.product_id AS productId, si.name, si.sku,
                SUM(si.qty) AS qty, SUM(si.line_total) AS revenue
         FROM sale_items si JOIN sales s ON s.id = si.sale_id
         WHERE s.status != 'voided' AND s.business_date BETWEEN ? AND ? ${scope}
         GROUP BY si.product_id, si.name, si.sku
         ORDER BY qty DESC, revenue DESC LIMIT 6`,
      )
      .all(from, to, ...scopeParams);

    const lowStock = db
      .prepare(
        `SELECT p.id, p.name, p.sku, p.stock, p.min_stock AS minStock, c.name AS categoryName
         FROM products p JOIN categories c ON c.id = p.category_id
         WHERE p.active = 1 AND p.stock > 0 AND p.stock <= p.min_stock
         ORDER BY p.stock ASC, p.name ASC LIMIT 6`,
      )
      .all();
    const lowStockCount = Number(
      db
        .prepare("SELECT COUNT(*) AS c FROM products WHERE active = 1 AND stock > 0 AND stock <= min_stock")
        .get().c,
    );
    const outOfStockCount = Number(
      db.prepare("SELECT COUNT(*) AS c FROM products WHERE active = 1 AND stock <= 0").get().c,
    );

    const recentSales = db
      .prepare(
        `SELECT s.id, s.ref, s.total, s.status, s.payment_method AS paymentMethod,
                s.created_at AS createdAt, u.name AS cashierName
         FROM sales s JOIN users u ON u.id = s.cashier_id
         WHERE s.business_date BETWEEN ? AND ? ${scope}
         ORDER BY s.created_at DESC LIMIT 6`,
      )
      .all(from, to, ...scopeParams);

    res.json({
      range: { from, to },
      scope: cashierId ? "cashier" : "business",
      kpis: {
        grossSales,
        refunds: refundAmount,
        netRevenue,
        transactions,
        itemsSold: units,
        avgSale: transactions ? Math.round(grossSales / transactions) : 0,
        discounts: Number(sales.discounts),
        profit,
        refundCount: Number(refunds.count),
        lowStockCount,
        outOfStockCount,
      },
      series,
      paymentMix,
      bestSellers,
      lowStock,
      recentSales,
    });
  } catch (error) {
    next(error);
  }
});
