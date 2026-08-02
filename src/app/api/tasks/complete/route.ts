import { NextResponse } from "next/server";
import { leaderboardService } from "@/lib/leaderboard";
import { errorResponse, identity, jsonObject } from "@/lib/leaderboard/http";
import { DomainError } from "@/lib/leaderboard/service";
import { awardAccountXp } from "@/lib/api/account-xp";

const WELLBEING_TASK_XP = 6;

export async function POST(request: Request) {
  try {
    const user = await identity(request);
    const body = await jsonObject(request);
    if (typeof body.taskId !== "string" || !body.taskId.trim() || body.taskId.length > 150) {
      throw new DomainError("INVALID_TASK", "taskId is required and must be at most 150 characters.");
    }
    const result = await leaderboardService.completeTask(
      user.userId, user.displayName, body.taskId.trim(),
    );
    const companion = await awardAccountXp(user.userId, WELLBEING_TASK_XP);
    return NextResponse.json({ ...result, xpAwarded: WELLBEING_TASK_XP, companion }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
