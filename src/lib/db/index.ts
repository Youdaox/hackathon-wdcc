import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

/** Shared PostgreSQL connection. DATABASE_URL is server-only. */
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must be set to use Incline's shared database.");

const globalForDb = globalThis as unknown as {
  inclineDb?: ReturnType<typeof drizzle>;
  inclineSql?: ReturnType<typeof postgres>;
};

const sql = globalForDb.inclineSql ?? postgres(databaseUrl, { max: 10 });
export const db = globalForDb.inclineDb ?? drizzle(sql, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.inclineDb = db;
  globalForDb.inclineSql = sql;
}

export { schema };
