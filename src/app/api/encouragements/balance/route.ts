import { NextResponse } from "next/server";
import { leaderboardService } from "@/lib/leaderboard";
import { errorResponse, identity } from "@/lib/leaderboard/http";

export async function GET(request: Request) {
  try {
    const { userId } = await identity(request);
    return NextResponse.json(await leaderboardService.getBalance(userId));
  } catch (error) { return errorResponse(error); }
}
