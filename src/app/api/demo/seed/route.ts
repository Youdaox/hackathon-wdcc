import { NextResponse } from "next/server";
import { leaderboardService } from "@/lib/leaderboard";
import { errorResponse } from "@/lib/leaderboard/http";

export async function POST() {
  try {
    return NextResponse.json(await leaderboardService.seedDemoData());
  } catch (error) {
    return errorResponse(error);
  }
}
