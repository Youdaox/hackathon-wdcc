import { NextResponse } from "next/server";
import { isNull, or, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { studySpots } from "@/lib/db/schema";

/**
 * Verified study locations for the session-start location check-in.
 *
 * Returns the shared campus spots (userId null) plus anything the user has
 * added. Coordinates are seeded from the web app's BONUS_ZONES, so all three
 * platforms measure against the same building centres.
 *
 * `multiplier` is included for display only — the client showing "1.5x" live
 * during a session is a UI nicety. The server re-reads the multiplier from
 * this table when a session is submitted, so a device cannot claim a bonus by
 * sending back an inflated value.
 */

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get("user_id");
  if (!userId?.trim()) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  try {
    const rows = db
      .select()
      .from(studySpots)
      .where(or(isNull(studySpots.userId), eq(studySpots.userId, userId)))
      .all();

    return NextResponse.json({
      spots: rows.map((row) => ({
        name: row.name,
        lat: row.lat,
        lng: row.lng,
        radius_m: row.radiusM,
        multiplier: row.multiplier,
      })),
    });
  } catch (error) {
    console.error("[study-spots] failed:", error);
    return NextResponse.json({ error: "failed to load study spots" }, { status: 500 });
  }
}
