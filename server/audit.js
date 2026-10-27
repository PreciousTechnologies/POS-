import { db, nowIso } from "./db.js";
import { randomId } from "./security.js";

export function logAudit({ userId = null, action, entity, entityId = null, description, meta = null, createdAt = nowIso() }) {
  db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, description, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomId(),
    userId,
    action,
    entity,
    entityId,
    description,
    meta ? JSON.stringify(meta) : null,
    createdAt,
  );
}
