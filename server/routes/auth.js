import { Router } from "express";
import { z } from "zod";
import { db, nowIso } from "../db.js";
import { httpError } from "../http.js";
import { signToken, serializeUser, requireAuth } from "../auth.js";
import { verifyPassword } from "../security.js";
import { logAudit } from "../audit.js";

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username."),
  password: z.string().min(1, "Enter your password."),
});

authRouter.post("/login", (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw httpError(400, parsed.error.issues[0]?.message ?? "Invalid credentials.");
    const { username, password } = parsed.data;
    const row = db.prepare("SELECT * FROM users WHERE lower(username) = lower(?)").get(username);
    if (!row || !verifyPassword(password, row.password_hash)) {
      throw httpError(401, "Incorrect username or password.");
    }
    if (!row.active) throw httpError(403, "This account has been deactivated. Contact an administrator.");

    const user = serializeUser(row);
    const token = signToken(user);
    logAudit({
      userId: user.id,
      action: "auth.login",
      entity: "user",
      entityId: user.id,
      description: `${user.name} signed in`,
      createdAt: nowIso(),
    });
    res.json({ token, user });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

authRouter.post("/logout", requireAuth, (req, res) => {
  logAudit({
    userId: req.user.id,
    action: "auth.logout",
    entity: "user",
    entityId: req.user.id,
    description: `${req.user.name} signed out`,
    createdAt: nowIso(),
  });
  res.json({ ok: true });
});
