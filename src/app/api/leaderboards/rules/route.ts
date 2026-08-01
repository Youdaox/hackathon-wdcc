import { NextResponse } from "next/server";
import { leaderboardService, type RankingRules } from "@/lib/leaderboard";
import { DomainError } from "@/lib/leaderboard/service";
import { errorResponse, jsonObject } from "@/lib/leaderboard/http";

export async function GET() {
  return NextResponse.json(await leaderboardService.getRules());
}

export async function PUT(request: Request) {
  try {
    const secret = process.env.LEADERBOARD_ADMIN_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
      throw new DomainError("FORBIDDEN", "Valid administrator credentials are required.", 403);
    }
    const body = await jsonObject(request);
    const keys = [
      "dailyBaseEncouragements", "encouragementsPerTask",
      "pointsPerTask", "pointsPerEncouragementReceived",
    ] as const;
    for (const key of keys) {
      if (!Number.isInteger(body[key]) || (body[key] as number) < 0 || (body[key] as number) > 10_000) {
        throw new DomainError("INVALID_RULES", `${key} must be an integer between 0 and 10000.`);
      }
    }
    if (body.timezone !== "UTC") {
      throw new DomainError("INVALID_RULES", "timezone must currently be UTC.");
    }
    return NextResponse.json(await leaderboardService.updateRules(body as unknown as RankingRules));
  } catch (error) { return errorResponse(error); }
}
