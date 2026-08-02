import { NextResponse } from "next/server";
import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { distractionEvents, sessions } from "@/lib/db/schema";
import { AWAY_REASONS, type AwayReason } from "@/lib/api/contract";
import { requireUserId } from "@/lib/api/identity";
import { addNewZealandDays, newZealandDate, nzDateKey, nzParts, nzStartOfDay } from "@/lib/timezone";

/**
 * Seven-day recap: per-day totals, a study streak, and the reason breakdown.
 *
 * The reason counts are the point. "You flagged emergency eight times this
 * week" is something a person can act on; "you were distracted for 96 minutes"
 * is just a number they already feel bad about. Aggregating server-side keeps
 * one definition of a study day across web and mobile.
 */

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function GET(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const requestedStart = url.searchParams.get("start_date");
    const requestedDays = Number(url.searchParams.get("days") ?? "7");
    const daysToInclude = Number.isInteger(requestedDays) && requestedDays > 0 && requestedDays <= 31
      ? requestedDays
      : 7;
    // New Zealand midnight, including its daylight-saving transitions.
    const today = nzStartOfDay();
    const dateParts = requestedStart?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const windowStart = dateParts
      ? newZealandDate(Number(dateParts[1]), Number(dateParts[2]), Number(dateParts[3]))
      : addNewZealandDays(today, 1 - daysToInclude);
    const windowEnd = addNewZealandDays(windowStart, daysToInclude);

    const rows = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), gte(sessions.endTime, windowStart.getTime()), lt(sessions.endTime, windowEnd.getTime())));

    const events = await db
      .select()
      .from(distractionEvents)
      .where(and(eq(distractionEvents.userId, userId), gte(distractionEvents.timestamp, windowStart.getTime()), lt(distractionEvents.timestamp, windowEnd.getTime())));

    // One bucket per requested day, oldest first, so a quiet day still renders as an empty
    // column instead of vanishing from the chart.
    const days = Array.from({ length: daysToInclude }, (_, i) => {
      const start = addNewZealandDays(windowStart, i);
      const end = addNewZealandDays(start, 1);
      const daySessions = rows.filter((r) => r.endTime >= start.getTime() && r.endTime < end.getTime());
      const dayEvents = events.filter((e) => e.timestamp >= start.getTime() && e.timestamp < end.getTime());

      const focusedMinutes = daySessions.reduce((sum, r) => sum + r.verifiedMinutes, 0);
      const distractedMinutes = dayEvents.reduce((sum, e) => sum + e.durationSeconds / 60, 0);

      return {
        date: nzDateKey(start),
        label: DAY_LABELS[nzParts(start).weekday],
        focused_minutes: Math.round(focusedMinutes),
        distracted_minutes: Math.round(distractedMinutes),
        sessions: daySessions.length,
      };
    });

    const reasons = Object.fromEntries(
      AWAY_REASONS.map((reason) => [
        reason,
        events.filter((e) => e.reason === reason).length,
      ]),
    ) as Record<AwayReason, number>;

    // Guess-vs-actual across the week. This is the number the check-in exists
    // to produce: how far off people are about their own drift.
    const guessed = events.filter((e) => e.guessedSeconds !== null);
    const guessGapSeconds =
      guessed.length === 0
        ? null
        : Math.round(
            guessed.reduce((sum, e) => sum + (e.durationSeconds - (e.guessedSeconds ?? 0)), 0) /
              guessed.length,
          );

    return NextResponse.json({
      days,
      reasons,
      study_days: days.filter((d) => d.sessions > 0).length,
      streak: currentStreak(days),
      total_focused_minutes: days.reduce((sum, d) => sum + d.focused_minutes, 0),
      total_distracted_minutes: days.reduce((sum, d) => sum + d.distracted_minutes, 0),
      /** Positive means the user under-estimates how long they were gone. */
      guess_gap_seconds: guessGapSeconds,
    });
  } catch (error) {
    console.error("[recap] failed:", error);
    return NextResponse.json({ error: "failed to build recap" }, { status: 500 });
  }
}

/**
 * Consecutive study days ending today.
 *
 * Today not counting yet is deliberate — a streak shouldn't break at midnight
 * before you've had a chance to study, so an empty today is skipped rather
 * than treated as a miss.
 */
function currentStreak(days: { sessions: number }[]): number {
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].sessions > 0) streak += 1;
    else if (i !== days.length - 1) break;
  }
  return streak;
}
