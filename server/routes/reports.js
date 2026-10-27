import { Router } from "express";
import { db, addDays, nowIso } from "../db.js";
import { httpError, strParam } from "../http.js";
import { requireAdmin, requireAuth } from "../auth.js";
import { resolveRange } from "./dashboard.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth, requireAdmin);

function dailySeries(from, to) {
  const salesRows = db
    .prepare(
      `SELECT business_date AS date, COALESCE(SUM(total), 0) AS revenue,
              COUNT(*) AS transactions, COUNT(DISTINCT cashier_id) AS cashiers
       FROM sales WHERE status != 'voided' AND business_date BETWEEN ? AND ?
       GROUP BY business_date`,
    )
    .all(from, to);
  const refundRows = db
    .prepare(
      `SELECT business_date AS date, COALESCE(SUM(amount), 0) AS refunds
       FROM refunds WHERE business_date BETWEEN ? AND ? GROUP BY business_date`,
    )
    .all(from, to);
  const salesMap = new Map(salesRows.map((row) => [row.date, row]));
  const refundMap = new Map(refundRows.map((row) => [row.date, Number(row.refunds)]));
  const dates = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates.map((date) => {
    const row = salesMap.get(date);
    const revenue = Number(row?.revenue ?? 0);
    const refunds = refundMap.get(date) ?? 0;
    return {
      date,
      revenue,
      refunds,
      net: revenue - refunds,
      transactions: Number(row?.transactions ?? 0),
      cashiers: Number(row?.cashiers ?? 0),
    };
  });
}

function summaryData(from, to) {
  const sales = db
    .prepare(
      `SELECT COUNT(*) AS transactions,
              COALESCE(SUM(total), 0) AS grossSales,
              COALESCE(SUM(discount), 0) AS discounts,
              COALESCE(SUM(cost_total), 0) AS costTotal,
              COALESCE(AVG(total), 0) AS avgSale
       FROM sales WHERE status != 'voided' AND business_date BETWEEN ? AND ?`,
    )
    .get(from, to);

  const units = Number(
    db
      .prepare(
        `SELECT COALESCE(SUM(si.qty), 0) AS units
         FROM sale_items si JOIN sales s ON s.id = si.sale_id
         WHERE s.status != 'voided' AND s.business_date BETWEEN ? AND ?`,
      )
      .get(from, to).units,
  );

  const refunds = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS amount, COALESCE(SUM(cost_amount), 0) AS cost, COUNT(*) AS count
       FROM refunds WHERE business_date BETWEEN ? AND ?`,
    )
    .get(from, to);

  const grossSales = Number(sales.grossSales);
  const refundAmount = Number(refunds.amount);
  const netRevenue = grossSales - refundAmount;

  const paymentMix = db
    .prepare(
      `SELECT p.method, COUNT(*) AS count, COALESCE(SUM(p.amount), 0) AS amount
       FROM payments p JOIN sales s ON s.id = p.sale_id
       WHERE s.status != 'voided' AND s.business_date BETWEEN ? AND ?
       GROUP BY p.method ORDER BY amount DESC`,
    )
    .all(from, to);

  const bestSellers = db
    .prepare(
      `SELECT si.product_id AS productId, si.name, si.sku,
              SUM(si.qty) AS qty, SUM(si.line_total) AS revenue
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE s.status != 'voided' AND s.business_date BETWEEN ? AND ?
       GROUP BY si.product_id, si.name, si.sku
       ORDER BY qty DESC, revenue DESC LIMIT 12`,
    )
    .all(from, to);

  const categories = db
    .prepare(
      `SELECT c.id, c.name, COALESCE(SUM(si.qty), 0) AS qty, COALESCE(SUM(si.line_total), 0) AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN products p ON p.id = si.product_id
       JOIN categories c ON c.id = p.category_id
       WHERE s.status != 'voided' AND s.business_date BETWEEN ? AND ?
       GROUP BY c.id, c.name ORDER BY revenue DESC`,
    )
    .all(from, to);

  const inventoryTotals = db
    .prepare(
      `SELECT COUNT(*) AS activeProducts,
              COALESCE(SUM(stock), 0) AS units,
              COALESCE(SUM(stock * cost_price), 0) AS costValue,
              COALESCE(SUM(stock * price), 0) AS retailValue,
              SUM(CASE WHEN stock <= 0 THEN 1 ELSE 0 END) AS outOfStock,
              SUM(CASE WHEN stock > 0 AND stock <= min_stock THEN 1 ELSE 0 END) AS lowStock
       FROM products WHERE active = 1`,
    )
    .get();

  const lowStock = db
    .prepare(
      `SELECT p.id, p.sku, p.name, p.stock, p.min_stock AS minStock, c.name AS categoryName
       FROM products p JOIN categories c ON c.id = p.category_id
       WHERE p.active = 1 AND p.stock > 0 AND p.stock <= p.min_stock
       ORDER BY p.stock ASC LIMIT 12`,
    )
    .all();
  const outOfStock = db
    .prepare(
      `SELECT p.id, p.sku, p.name, p.stock, p.min_stock AS minStock, c.name AS categoryName
       FROM products p JOIN categories c ON c.id = p.category_id
       WHERE p.active = 1 AND p.stock <= 0
       ORDER BY p.name ASC LIMIT 12`,
    )
    .all();

  const statusBreakdown = db
    .prepare(
      `SELECT status, COUNT(*) AS count, COALESCE(SUM(total), 0) AS total
       FROM sales WHERE business_date BETWEEN ? AND ? GROUP BY status`,
    )
    .all(from, to);

  return {
    range: { from, to },
    generatedAt: nowIso(),
    totals: {
      grossSales,
      refunds: refundAmount,
      netRevenue,
      profit: grossSales - Number(sales.costTotal) - Number(refunds.cost),
      discounts: Number(sales.discounts),
      transactions: Number(sales.transactions),
      itemsSold: units,
      avgSale: Number(sales.transactions) ? Math.round(grossSales / Number(sales.transactions)) : 0,
      refundCount: Number(refunds.count),
    },
    series: dailySeries(from, to),
    paymentMix,
    bestSellers,
    categories,
    inventory: {
      ...inventoryTotals,
      units: Number(inventoryTotals.units),
      costValue: Number(inventoryTotals.costValue),
      retailValue: Number(inventoryTotals.retailValue),
      lowStock: Number(inventoryTotals.lowStock),
      outOfStock: Number(inventoryTotals.outOfStock),
    },
    lowStock,
    outOfStock,
    statusBreakdown,
  };
}

reportsRouter.get("/summary", (req, res, next) => {
  try {
    const { from, to } = resolveRange(req.query, 30);
    res.json(summaryData(from, to));
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/export", (req, res, next) => {
  try {
    const { from, to } = resolveRange(req.query, 30);
    const type = strParam(req.query.type, "sales");
    let rows;
    let filename;

    if (type === "sales") {
      rows = db
        .prepare(
          `SELECT s.ref AS "Reference", s.business_date AS "Date", u.name AS "Cashier",
                  s.customer_name AS "Customer", s.payment_method AS "Payment method",
                  s.status AS "Status", s.subtotal AS "Subtotal (TZS)", s.discount AS "Discount (TZS)",
                  s.total AS "Total (TZS)", s.refunded_amount AS "Refunded (TZS)"
           FROM sales s JOIN users u ON u.id = s.cashier_id
           WHERE s.business_date BETWEEN ? AND ?
           ORDER BY s.created_at DESC`,
        )
        .all(from, to);
      filename = `sales-${from}_to_${to}.csv`;
    } else if (type === "inventory") {
      rows = db
        .prepare(
          `SELECT p.sku AS "SKU", p.name AS "Product", c.name AS "Category", p.stock AS "Stock",
                  p.min_stock AS "Min stock", p.cost_price AS "Cost price (TZS)", p.price AS "Selling price (TZS)",
                  (p.stock * p.cost_price) AS "Cost value (TZS)", (p.stock * p.price) AS "Retail value (TZS)",
                  CASE WHEN p.stock <= 0 THEN 'Out of stock' WHEN p.stock <= p.min_stock THEN 'Low stock' ELSE 'In stock' END AS "Status"
           FROM products p JOIN categories c ON c.id = p.category_id
           WHERE p.active = 1 ORDER BY c.name, p.name`,
        )
        .all();
      filename = `inventory-${from}_to_${to}.csv`;
    } else if (type === "best-sellers") {
      rows = db
        .prepare(
          `SELECT si.name AS "Product", si.sku AS "SKU", SUM(si.qty) AS "Quantity sold",
                  SUM(si.line_total) AS "Sales value (TZS)"
           FROM sale_items si JOIN sales s ON s.id = si.sale_id
           WHERE s.status != 'voided' AND s.business_date BETWEEN ? AND ?
           GROUP BY si.product_id, si.name, si.sku
           ORDER BY SUM(si.qty) DESC`,
        )
        .all(from, to);
      filename = `best-sellers-${from}_to_${to}.csv`;
    } else if (type === "summary") {
      const data = summaryData(from, to);
      rows = [
        { Metric: "Gross sales (TZS)", Value: data.totals.grossSales },
        { Metric: "Refunds (TZS)", Value: data.totals.refunds },
        { Metric: "Net revenue (TZS)", Value: data.totals.netRevenue },
        { Metric: "Estimated profit (TZS)", Value: data.totals.profit },
        { Metric: "Discounts (TZS)", Value: data.totals.discounts },
        { Metric: "Completed transactions", Value: data.totals.transactions },
        { Metric: "Items sold", Value: data.totals.itemsSold },
        { Metric: "Average sale (TZS)", Value: data.totals.avgSale },
        { Metric: "Inventory cost value (TZS)", Value: data.inventory.costValue },
        { Metric: "Inventory retail value (TZS)", Value: data.inventory.retailValue },
        { Metric: "Low stock products", Value: data.inventory.lowStock },
        { Metric: "Out of stock products", Value: data.inventory.outOfStock },
      ];
      filename = `summary-${from}_to_${to}.csv`;
    } else {
      throw httpError(400, "Unknown export type.");
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(`\uFEFF${toCsv(rows)}`);
  } catch (error) {
    next(error);
  }
});

function cell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(cell).join(",")];
  for (const row of rows) lines.push(headers.map((h) => cell(row[h])).join(","));
  return lines.join("\r\n");
}
