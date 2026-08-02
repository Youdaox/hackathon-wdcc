import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { LeaderboardRepository, LeaderboardSnapshot } from "./repository";

const DEFAULT_STATE: LeaderboardSnapshot = {
  members: [], encouragements: [], taskCompletions: [],
  rules: { dailyBaseEncouragements: 3, encouragementsPerTask: 1, pointsPerTask: 10, pointsPerEncouragementReceived: 4, timezone: "Pacific/Auckland" },
};

function withNewZealandTimezone(snapshot: LeaderboardSnapshot): LeaderboardSnapshot {
  snapshot.rules = { ...snapshot.rules, timezone: "Pacific/Auckland" };
  return snapshot;
}

/** Stores the leaderboard atomically in the shared database, not process memory. */
export class DatabaseLeaderboardRepository implements LeaderboardRepository {
  async read<T>(operation: (snapshot: Readonly<LeaderboardSnapshot>) => T): Promise<T> {
    await db.execute(sql`INSERT INTO leaderboard_state (id, snapshot) VALUES (true, ${JSON.stringify(DEFAULT_STATE)}::jsonb) ON CONFLICT (id) DO NOTHING`);
    const result = await db.execute(sql`SELECT snapshot FROM leaderboard_state WHERE id = true`);
    const snapshot = structuredClone((result[0]?.snapshot ?? DEFAULT_STATE) as LeaderboardSnapshot);
    return operation(withNewZealandTimezone(snapshot));
  }

  async write<T>(operation: (snapshot: LeaderboardSnapshot) => T): Promise<T> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`INSERT INTO leaderboard_state (id, snapshot) VALUES (true, ${JSON.stringify(DEFAULT_STATE)}::jsonb) ON CONFLICT (id) DO NOTHING`);
      const result = await tx.execute(sql`SELECT snapshot FROM leaderboard_state WHERE id = true FOR UPDATE`);
      const snapshot = withNewZealandTimezone(structuredClone((result[0]?.snapshot ?? DEFAULT_STATE) as LeaderboardSnapshot));
      const value = operation(snapshot);
      await tx.execute(sql`UPDATE leaderboard_state SET snapshot = ${JSON.stringify(snapshot)}::jsonb WHERE id = true`);
      return value;
    });
  }
}

export const leaderboardRepository = new DatabaseLeaderboardRepository();
