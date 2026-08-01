import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { companions, users } from "@/lib/db/schema";
import { applyIdleDecay, createCompanion } from "@/lib/companion";
import type { Companion } from "@/lib/types";

/**
 * Ensures a user and companion row exist, and returns the companion with
 * neglect decay already applied.
 *
 * Rows are created on first sight because there is no auth or signup flow —
 * `user_id` is whatever string the client sends. Fine for a demo, and the one
 * thing that has to change before this is exposed publicly.
 */
export function ensureCompanion(userId: string): Companion {
  const now = Date.now();

  db.insert(users).values({ id: userId, createdAt: now }).onConflictDoNothing().run();

  const existing = db.select().from(companions).where(eq(companions.userId, userId)).get();

  if (!existing) {
    const fresh = createCompanion();
    db.insert(companions)
      .values({ userId, ...fresh })
      .run();
    return fresh;
  }

  // Rebuilt field-by-field rather than spread, so the row's `userId` column
  // can't leak into the Companion shape the growth rules operate on.
  const companion: Companion = {
    name: existing.name,
    species: existing.species,
    level: existing.level,
    xp: existing.xp,
    hp: existing.hp,
    totalFocusedMs: existing.totalFocusedMs,
    lastSessionAt: existing.lastSessionAt,
    createdAt: existing.createdAt,
  };

  // Decay is applied on read rather than by a cron job, exactly as the web app
  // does it on load — so a phone that has been closed for three days sees the
  // same wilted pet the browser would.
  const decayed = applyIdleDecay(companion, now);
  if (decayed.hp !== companion.hp) {
    db.update(companions).set({ hp: decayed.hp }).where(eq(companions.userId, userId)).run();
  }
  return decayed;
}
