import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { friendships, sessions, users } from "@/lib/db/schema";
import { errorResponse, identity } from "@/lib/leaderboard/http";

type FocusLeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  focusedMs: number;
  unfocusedMs: number;
};

/** Friends-only board: unfocused time is a session's wall-clock time minus verified focus. */
export async function GET(request: Request) {
  try {
    const { userId } = await identity(request);
    const links = await db.select({ friendId: friendships.friendId }).from(friendships).where(eq(friendships.userId, userId));
    const friendIds = [...new Set(links.map((link) => link.friendId))];
    if (!friendIds.length) return NextResponse.json({ entries: [] satisfies FocusLeaderboardEntry[] });

    const [friendRows, sessionRows] = await Promise.all([
      db.select({ id: users.id, displayName: users.displayName }).from(users).where(inArray(users.id, friendIds)),
      db.select({ userId: sessions.userId, startTime: sessions.startTime, endTime: sessions.endTime, verifiedMinutes: sessions.verifiedMinutes }).from(sessions).where(inArray(sessions.userId, friendIds)),
    ]);
    const totals = new Map<string, { focusedMs: number; unfocusedMs: number }>();
    for (const row of sessionRows) {
      const focusedMs = Math.max(0, Math.round(row.verifiedMinutes * 60_000));
      const total = totals.get(row.userId) ?? { focusedMs: 0, unfocusedMs: 0 };
      total.focusedMs += focusedMs;
      total.unfocusedMs += Math.max(0, row.endTime - row.startTime - focusedMs);
      totals.set(row.userId, total);
    }
    const entries = friendRows.map((friend) => ({ userId: friend.id, displayName: friend.displayName, ...(totals.get(friend.id) ?? { focusedMs: 0, unfocusedMs: 0 }) }))
      .sort((a, b) => b.focusedMs - a.focusedMs || a.unfocusedMs - b.unfocusedMs || a.displayName.localeCompare(b.displayName))
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
    return NextResponse.json({ entries });
  } catch (error) { return errorResponse(error); }
}
