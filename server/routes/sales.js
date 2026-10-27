import { Router } from "express";
import { z } from "zod";
import { httpError } from "../http.js";
import { requireAdmin, requireAuth } from "../auth.js";
import { checkout, getSaleDetail, listSales, refundSale, voidSale } from "../services/sales.js";

export const salesRouter = Router();
salesRouter.use(requireAuth);

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().positive().max(9999),
      }),
    )
    .min(1, "Add at least one product to the cart.")
    .max(100),
  discount: z.number().int().min(0).max(1000000000).optional().default(0),
  paymentMethod: z.enum(["cash", "mobile_money", "card"]),
  amountReceived: z.number().int().min(0).max(10000000000).optional(),
  mobileProvider: z.string().trim().max(40).optional(),
  cardProvider: z.string().trim().max(40).optional(),
  customerName: z.string().trim().max(120).optional(),
  note: z.string().trim().max(300).optional(),
  idempotencyKey: z.string().min(8, "Missing checkout idempotency key.").max(120),
});

salesRouter.get("/", (req, res, next) => {
  try {
    res.json(listSales(req.user, req.query ?? {}));
  } catch (error) {
    next(error);
  }
});

salesRouter.post("/checkout", (req, res, next) => {
  try {
    const parsed = checkoutSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw httpError(400, parsed.error.issues[0]?.message ?? "Invalid checkout request.");
    const result = checkout(req.user, parsed.data);
    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (error) {
    next(error);
  }
});

salesRouter.get("/:id", (req, res, next) => {
  try {
    res.json(getSaleDetail(req.params.id, req.user));
  } catch (error) {
    next(error);
  }
});

salesRouter.post("/:id/void", requireAdmin, (req, res, next) => {
  try {
    res.json(voidSale(req.user, req.params.id));
  } catch (error) {
    next(error);
  }
});

const refundSchema = z.object({
  amount: z.number().int().positive("Refund amount must be greater than zero."),
  reason: z.string().trim().min(3, "A refund reason is required.").max(300),
  restock: z.boolean().optional().default(false),
});

salesRouter.post("/:id/refund", requireAdmin, (req, res, next) => {
  try {
    const parsed = refundSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw httpError(400, parsed.error.issues[0]?.message ?? "Invalid refund request.");
    res.json(refundSale(req.user, req.params.id, parsed.data));
  } catch (error) {
    next(error);
  }
});
