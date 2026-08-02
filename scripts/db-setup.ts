/** Applies PostgreSQL migrations and seeds shared study spots.
 *
 * DATABASE_URL="postgresql://..." npm run db:setup
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { isNull } from "drizzle-orm";
import { BONUS_ZONES } from "../src/lib/zones.ts";
import { studySpots } from "../src/lib/db/schema.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");
const sql = postgres(databaseUrl, { max: 1 });
const db = drizzle(sql);

await migrate(db, { migrationsFolder: "./drizzle-pg" });
await db.delete(studySpots).where(isNull(studySpots.userId));
for (const zone of BONUS_ZONES) {
  await db.insert(studySpots).values({
    id: zone.id, userId: null, name: zone.name, lat: zone.lat, lng: zone.lng,
    radiusM: zone.radiusM, multiplier: zone.multiplier, createdAt: Date.now(),
  }).onConflictDoNothing();
}
console.log(`migrations applied and seeded ${BONUS_ZONES.length} shared study spots`);
await sql.end();
