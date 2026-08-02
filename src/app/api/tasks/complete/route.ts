import { NextResponse } from "next/server";
import { leaderboardService } from "@/lib/leaderboard";
import { errorResponse, identity, jsonObject } from "@/lib/leaderboard/http";
import { DomainError } from "@/lib/leaderboard/service";

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
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
