import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(here, "..");

// Vercel Functions only allow writes under the OS temp directory, so fall back
// to /tmp there instead of the read-only project folder. Data is ephemeral:
// it is re-seeded whenever a new function instance starts.
const IS_SERVERLESS = Boolean(process.env.VERCEL);
const DEFAULT_DATA_DIR = IS_SERVERLESS
  ? path.join(os.tmpdir(), "kariakoo-pos")
  : path.join(ROOT_DIR, "data");

export const DATA_DIR = process.env.POS_DATA_DIR
  ? path.resolve(process.env.POS_DATA_DIR)
  : DEFAULT_DATA_DIR;
export const DB_PATH = process.env.POS_DB_PATH
  ? path.resolve(process.env.POS_DB_PATH)
  : path.join(DATA_DIR, "pos.db");
export const SECRET_PATH = path.join(DATA_DIR, "session.secret");

fs.mkdirSync(DATA_DIR, { recursive: true });
