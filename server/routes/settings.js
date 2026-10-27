import { Router } from "express";
import { z } from "zod";
import { db, getSettingsRow, nowIso } from "../db.js";
import { httpError } from "../http.js";
import { requireAdmin, requireAuth } from "../auth.js";
import { logAudit } from "../audit.js";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

function shape(row) {
  return {
    businessName: row.business_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    tin: row.tin,
    currency: row.currency,
    timezone: row.timezone,
    receiptFooter: row.receipt_footer,
    lowStockThreshold: row.low_stock_threshold,
    allowDiscounts: Boolean(row.allow_discounts),
    discountLimitPct: row.discount_limit_pct,
    updatedAt: row.updated_at,
  };
}

settingsRouter.get("/", (_req, res) => {
  res.json(shape(getSettingsRow()));
});

const settingsSchema = z.object({
  businessName: z.string().trim().min(2, "Business name is required.").max(120),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid business email.").max(120).optional().or(z.literal("")),
  address: z.string().trim().max(240).optional().or(z.literal("")),
  tin: z.string().trim().max(40).optional().or(z.literal("")),
  receiptFooter: z.string().trim().max(500).optional().or(z.literal("")),
  timezone: z.string().trim().min(3).max(60),
  lowStockThreshold: z.number().int().min(0).max(100000),
  allowDiscounts: z.boolean(),
  discountLimitPct: z.number().int().min(0).max(100),
});

settingsRouter.put("/", requireAdmin, (req, res, next) => {
  try {
    const parsed = settingsSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw httpError(400, parsed.error.issues[0]?.message ?? "Invalid settings.");
    const data = parsed.data;

    try {
      new Intl.DateTimeFormat("en-US", { timeZone: data.timezone });
    } catch {
      throw httpError(400, "Select a valid timezone.");
    }

    const ts = nowIso();
    db.prepare(
      `UPDATE business_settings SET
        business_name = ?, phone = ?, email = ?, address = ?, tin = ?,
        currency = 'TZS', timezone = ?, receipt_footer = ?, low_stock_threshold = ?,
        allow_discounts = ?, discount_limit_pct = ?, updated_at = ?
       WHERE id = 1`,
    ).run(
      data.businessName,
      data.phone || null,
      data.email || null,
      data.address || null,
      data.tin || null,
      data.timezone,
      data.receiptFooter || null,
      data.lowStockThreshold,
      data.allowDiscounts ? 1 : 0,
      data.discountLimitPct,
      ts,
    );

    logAudit({
      userId: req.user.id,
      action: "settings.update",
      entity: "settings",
      entityId: "1",
      description: "Updated business profile and receipt settings",
      meta: {
        businessName: data.businessName,
        timezone: data.timezone,
        allowDiscounts: data.allowDiscounts,
        discountLimitPct: data.discountLimitPct,
      },
      createdAt: ts,
    });

    res.json(shape(getSettingsRow()));
  } catch (error) {
    next(error);
  }
});
