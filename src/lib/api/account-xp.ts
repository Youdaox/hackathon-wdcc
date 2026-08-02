import { eq } from "drizzle-orm";
import { awardBonusXp } from "@/lib/companion";
import { db } from "@/lib/db";
import { companions } from "@/lib/db/schema";
import { ensureCompanion } from "@/lib/api/users";
import type { Companion } from "@/lib/types";

/** Awards a verified non-session action to the signed-in account's companion. */
export async function awardAccountXp(userId: string, amount: number): Promise<Companion> {
  const companion = await ensureCompanion(userId);
  const next = awardBonusXp(companion, amount);
  await db.update(companions)
    .set({ level: next.level, xp: next.xp })
    .where(eq(companions.userId, userId));
  return next;
}
