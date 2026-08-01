import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

/**
 * SQLite connection, shared across route handlers.
 *
 * File-based on purpose: a hackathon venue's wifi is not a dependency we want
 * between a phone and its own pet. Set `INCLINE_DB_PATH` to relocate it.
 *
 * The global cache survives Next's dev-server hot reloads — without it every
 * edit opens another handle to the same file and they eventually collide.
 */

const DB_PATH = process.env.INCLINE_DB_PATH ?? "incline.db";

const globalForDb = globalThis as unknown as {
  inclineDb?: ReturnType<typeof createDb>;
};

function createDb() {
  const sqlite = new Database(DB_PATH);
  // WAL lets the seed script and the dev server hold the file at once.
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export const db = globalForDb.inclineDb ?? createDb();

if (process.env.NODE_ENV !== "production") globalForDb.inclineDb = db;

export { schema };
