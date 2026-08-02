import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { friendships, sessions, users } from "@/lib/db/schema";
import { errorResponse, identity } from "@/lib/leaderboard/http";

/** The user and their friends: unfocused time is wall-clock time minus verified focus. */
export async function GET(request: Request) {
  try {
    const { userId, displayName } = await identity(request);
    const links = await db.select({ friendId: friendships.friendId }).from(friendships).where(eq(friendships.userId, userId));
    const friendIds = [...new Set(links.map((link) => link.friendId))];
    // Always include the signed-in person, so their focus details are visible
    // before they add a friend and the comparison stays internally consistent.
    const participantIds = [...new Set([userId, ...friendIds])];

    const [participantRows, sessionRows] = await Promise.all([
      db.select({ id: users.id, displayName: users.displayName }).from(users).where(inArray(users.id, participantIds)),
      db.select({ userId: sessions.userId, startTime: sessions.startTime, endTime: sessions.endTime, verifiedMinutes: sessions.verifiedMinutes }).from(sessions).where(inArray(sessions.userId, participantIds)),
    ]);
    const totals = new Map<string, { focusedMs: number; unfocusedMs: number }>();
    for (const row of sessionRows) {
      const focusedMs = Math.max(0, Math.round(row.verifiedMinutes * 60_000));
      const total = totals.get(row.userId) ?? { focusedMs: 0, unfocusedMs: 0 };
      total.focusedMs += focusedMs;
      total.unfocusedMs += Math.max(0, row.endTime - row.startTime - focusedMs);
      totals.set(row.userId, total);
    }
    const names = new Map(participantRows.map((participant) => [participant.id, participant.displayName]));
    const entries = participantIds.map((id) => ({
      userId: id,
      displayName: names.get(id) ?? (id === userId ? displayName : id),
      ...(totals.get(id) ?? { focusedMs: 0, unfocusedMs: 0 }),
    }))
      .sort((a, b) => b.focusedMs - a.focusedMs || a.unfocusedMs - b.unfocusedMs || a.displayName.localeCompare(b.displayName))
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
    return NextResponse.json({ entries });
  } catch (error) { return errorResponse(error); }
}
