import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const testDbPath = path.resolve(process.cwd(), ".tmp-auth-test.db");

afterEach(() => {
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  if (fs.existsSync(`${testDbPath}-wal`)) fs.unlinkSync(`${testDbPath}-wal`);
  if (fs.existsSync(`${testDbPath}-shm`)) fs.unlinkSync(`${testDbPath}-shm`);
});

test("migrations create the auth tables for a fresh SQLite database", () => {
  const sqlite = new Database(testDbPath);
  const db = drizzle(sqlite);
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");

  migrate(db, { migrationsFolder });

  const tables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as Array<{ name: string }>;

  const tableNames = tables.map((row) => row.name);

  sqlite.close();

  assert.ok(tableNames.includes("users"), `Expected users table to exist, got ${JSON.stringify(tableNames)}`);
  assert.ok(tableNames.includes("auth_sessions"), `Expected auth_sessions table to exist, got ${JSON.stringify(tableNames)}`);
});
