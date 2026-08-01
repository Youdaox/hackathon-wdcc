import { NextResponse } from "next/server";
import { leaderboardService, type LeaderboardPeriod } from "@/lib/leaderboard";
import { DomainError } from "@/lib/leaderboard/service";
import { errorResponse } from "@/lib/leaderboard/http";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const period = url.searchParams.get("period") ?? "week";
    if (period !== "week" && period !== "month") {
      throw new DomainError("INVALID_PERIOD", "period must be week or month.");
    }
    const rawLimit = Number(url.searchParams.get("limit") ?? 50);
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
      throw new DomainError("INVALID_LIMIT", "limit must be an integer between 1 and 100.");
    }
    return NextResponse.json(
      await leaderboardService.getLeaderboard(period as LeaderboardPeriod, new Date(), rawLimit),
    );
  } catch (error) { return errorResponse(error); }
}
