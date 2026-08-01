/**
 * Creates the SQLite file, applies migrations, and seeds the shared campus
 * study spots. Safe to re-run — migrations are tracked and the seed upserts.
 *
 *   npm run db:setup
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { isNull } from "drizzle-orm";
// Explicit .ts extensions: this script runs directly under Node's type
// stripping (ESM resolution), not through the Next.js bundler.
import { BONUS_ZONES } from "../src/lib/zones.ts";
import { studySpots } from "../src/lib/db/schema.ts";

const DB_PATH = process.env.INCLINE_DB_PATH ?? "incline.db";

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: "./drizzle" });
console.log(`migrations applied → ${DB_PATH}`);

/**
 * Shared spots are seeded from the web app's BONUS_ZONES rather than
 * re-typed, so all three platforms agree on where the library actually is.
 * Recalibrating zones.ts on site updates mobile too, after a re-seed.
 */
const now = Date.now();
db.delete(studySpots).where(isNull(studySpots.userId)).run();
for (const zone of BONUS_ZONES) {
  db.insert(studySpots)
    .values({
      id: zone.id,
      userId: null,
      name: zone.name,
      lat: zone.lat,
      lng: zone.lng,
      radiusM: zone.radiusM,
      multiplier: zone.multiplier,
      createdAt: now,
    })
    .run();
}
console.log(`seeded ${BONUS_ZONES.length} shared study spots`);

sqlite.close();
