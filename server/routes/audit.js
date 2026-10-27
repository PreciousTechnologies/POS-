import { Router } from "express";
import { db } from "../db.js";
import { intParam, strParam } from "../http.js";
import { requireAdmin, requireAuth } from "../auth.js";

export const auditRouter = Router();
auditRouter.use(requireAuth, requireAdmin);

auditRouter.get("/", (req, res) => {
  const page = intParam(req.query.page, 1);
  const pageSize = intParam(req.query.pageSize, 15, 5, 100);
  const search = strParam(req.query.search);
  const action = strParam(req.query.action);

  const conditions = [];
  const params = [];
  if (action) {
    conditions.push("a.action = ?");
    params.push(action);
  }
  if (search) {
    conditions.push("(a.description LIKE ? OR u.name LIKE ? OR a.entity LIKE ? OR a.action LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const total = Number(
    db
      .prepare(`SELECT COUNT(*) AS c FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ${where}`)
      .get(...params).c,
  );

  const items = db
    .prepare(
      `SELECT a.id, a.action, a.entity, a.entity_id AS entityId, a.description,
              a.meta, a.created_at AS createdAt, u.name AS userName, u.role AS userRole
       FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize)
    .map((row) => ({
      ...row,
      meta: row.meta ? safeJson(row.meta) : null,
    }));

  const actions = db
    .prepare("SELECT action, COUNT(*) AS count FROM audit_logs GROUP BY action ORDER BY count DESC")
    .all();

  res.json({ items, total, page, pageSize, actions });
});

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
