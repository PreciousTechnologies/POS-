import express from "express";
import path from "node:path";
import "./db.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { categoriesRouter } from "./routes/categories.js";
import { productsRouter } from "./routes/products.js";
import { inventoryRouter } from "./routes/inventory.js";
import { salesRouter } from "./routes/sales.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { reportsRouter } from "./routes/reports.js";
import { settingsRouter } from "./routes/settings.js";
import { auditRouter } from "./routes/audit.js";

/**
 * Build the Kariakoo POS Express application.
 *
 * Shared by the self-hosted entry point (server/index.js) and the Vercel
 * serverless entry point (api/index.js). Serving the built SPA is opt-in via
 * `staticDir` because on Vercel the CDN handles static assets.
 */
export function createApp({ staticDir = null } = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "kariakoo-pos", time: new Date().toISOString() });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/inventory", inventoryRouter);
  app.use("/api/sales", salesRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/audit", auditRouter);

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found." });
  });

  // Serve the built single-page app in production.
  if (staticDir) {
    app.use(express.static(staticDir, { index: false }));
    app.use((req, res, next) => {
      if (req.method !== "GET") return next();
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  app.use((error, _req, res, _next) => {
    const status = Number(error?.status) || (error?.type === "entity.parse.failed" ? 400 : 500);
    if (status >= 500) {
      console.error("[api]", error);
    }
    const message =
      status >= 500
        ? "Something went wrong on the server. Please try again."
        : error?.message || "Request could not be completed.";
    res.status(status).json({ error: message, details: error?.details ?? null });
  });

  return app;
}
