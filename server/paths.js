import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(here, "..");
export const DATA_DIR = process.env.POS_DATA_DIR
  ? path.resolve(process.env.POS_DATA_DIR)
  : path.join(ROOT_DIR, "data");
export const DB_PATH = process.env.POS_DB_PATH
  ? path.resolve(process.env.POS_DB_PATH)
  : path.join(DATA_DIR, "pos.db");
export const SECRET_PATH = path.join(DATA_DIR, "session.secret");

fs.mkdirSync(DATA_DIR, { recursive: true });
