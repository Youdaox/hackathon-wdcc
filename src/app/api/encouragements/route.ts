import { NextResponse } from "next/server";
import { errorResponse, identity, jsonObject } from "@/lib/leaderboard/http";
import { leaderboardService } from "@/lib/leaderboard";
import { DomainError } from "@/lib/leaderboard/service";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { friendships } from "@/lib/db/schema";

export async function GET(request: Request) {
  try {
    const { userId } = await identity(request);
    const searchParams = new URL(request.url).searchParams;
    const rawLimit = Number(searchParams.get("limit") ?? 50);
    const direction = searchParams.get("direction") ?? "received";
    if (direction !== "received" && direction !== "sent") {
      throw new DomainError("INVALID_DIRECTION", "direction must be received or sent.");
    }
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
      throw new DomainError("INVALID_LIMIT", "limit must be an integer between 1 and 100.");
    }
    return NextResponse.json({
      encouragements: await leaderboardService.getEncouragementHistory(userId, direction, rawLimit),
    });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const sender = await identity(request);
    const body = await jsonObject(request);
    if (typeof body.recipientId !== "string" || !body.recipientId.trim() || body.recipientId.length > 100) {
      throw new DomainError("INVALID_RECIPIENT", "recipientId is required and must be at most 100 characters.");
    }
    const recipientName = typeof body.recipientName === "string" ? body.recipientName.slice(0, 80) : undefined;
    const [friendship] = await db.select({ id: friendships.id }).from(friendships)
      .where(and(eq(friendships.userId, sender.userId), eq(friendships.friendId, body.recipientId.trim())));
    if (!friendship) throw new DomainError("FRIEND_REQUIRED", "Add this person as a friend before sending encouragement.", 403);
    const result = await leaderboardService.sendEncouragement(
      sender.userId, sender.displayName, body.recipientId.trim(), recipientName,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
