import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { companions, distractionEvents, sessions, studySpots } from "@/lib/db/schema";
import { applySession, uid } from "@/lib/companion";

/**
 * What leaving costs. Mirrors `hpCostForAway` in mobile/src/config.ts — the
 * two must agree or the live number contradicts what gets written on sync.
 *
 * Front-loaded on purpose: a flat hit for picking the phone up, a steady drain
 * while away, and a steeper rate past the escalation point, so a five-second
 * glance doesn't feel like a five-minute scroll.
 */
const HP_LEAVE_PENALTY = 5;
const HP_DRAIN_PER_AWAY_MINUTE = 2;
const HP_ESCALATE_AFTER_MS = 30_000;
const HP_ESCALATED_MULTIPLIER = 3;

function hpCostForAway(awayMs: number): number {
  if (awayMs <= 0) return 0;
  const steady = (Math.min(awayMs, HP_ESCALATE_AFTER_MS) / 60_000) * HP_DRAIN_PER_AWAY_MINUTE;
  const overrun = Math.max(0, awayMs - HP_ESCALATE_AFTER_MS);
  return (
    HP_LEAVE_PENALTY +
    steady +
    (overrun / 60_000) * HP_DRAIN_PER_AWAY_MINUTE * HP_ESCALATED_MULTIPLIER
  );
}
import { ensureCompanion } from "@/lib/api/users";
import { requireUserId } from "@/lib/api/identity";
import {
  evaluatePledge,
  parseSessionRequest,
  toWebDistraction,
  type SessionResponse,
} from "@/lib/api/contract";

/**
 * Records a completed focus session and grows the companion.
 *
 * This endpoint is the reason the server exists. Growth is computed *here*,
 * not on the device: three clients each running their own `applySession()`
 * against their own local pet would produce three different pets, and
 * `pet_growth_delta` would be an echo of whatever the client already decided.
 *
 * The rules themselves are not reimplemented — `applySession()` is imported
 * from `src/lib/companion.ts`, the same pure function the web app runs. There
 * is exactly one copy of the balance table.
 */

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = parseSessionRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const req = parsed.value;

  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  try {
    const companion = await ensureCompanion(userId);

    // The client reports *where* it was; the server decides what that is
    // worth. A device claiming "General Library" cannot invent a multiplier.
    let xpMultiplier = 1;
    if (req.location_verified && req.location_name) {
      const [spot] = await db
        .select()
        .from(studySpots)
        .where(eq(studySpots.name, req.location_name))
        ;
      if (spot) xpMultiplier = spot.multiplier;
    }

    // A broken pledge forfeits the XP but keeps the HP consequences: the
    // session still happened, it just earned nothing. Zeroing focused time
    // rather than the result means levels can't creep up on a forfeit.
    const pledge = evaluatePledge(
      req.committed_minutes ?? 0,
      (Date.parse(req.end_time) - Date.parse(req.start_time)) / 60_000,
      req.distraction_events,
    );

    // HP also drains with time away, not just per break, so picking up the
    // phone costs something continuously — which is what the client shows
    // live. Reasons the user isn't penalised for are excluded, matching the
    // rule the check-in already applies.
    // Per stretch, not on the total: the flat leave penalty should be paid
    // once per time you picked the phone up, and escalation is per-absence.
    const hpDrain = req.distraction_events
      .filter((e) => e.reason === null || e.reason === undefined || e.reason === "distraction")
      .reduce((sum, e) => sum + hpCostForAway(e.duration_seconds * 1000), 0);

    const distractions = req.distraction_events.map(toWebDistraction);
    const result = applySession(
      companion,
      {
        focusedMs: pledge.voided ? 0 : req.verified_minutes * 60_000,
        distractions,
        // Flat, and forfeited along with everything else on a broken pledge.
        bonusXp: pledge.voided ? 0 : (req.bonus_xp ?? 0),
      },
      xpMultiplier,
    );

    const drained = {
      ...result.companion,
      hp: Math.max(0, Math.min(100, result.companion.hp - hpDrain)),
    };
    const hpDelta = Math.round(drained.hp - companion.hp);

    const sessionId = uid();
    const now = Date.now();

    // One transaction: a session that grows the pet but loses its own
    // distraction rows would make the growth impossible to explain afterward.
    await db.transaction(async (tx) => {
      await tx.insert(sessions)
        .values({
          id: sessionId,
          userId: userId,
          startTime: Date.parse(req.start_time),
          endTime: Date.parse(req.end_time),
          verifiedMinutes: req.verified_minutes,
          locationVerified: req.location_verified,
          locationName: req.location_name,
          platform: req.platform,
          xpEarned: result.xpEarned,
          hpDelta,
          xpMultiplier,
          committedMinutes: req.committed_minutes ?? 0,
          voided: pledge.voided,
          createdAt: now,
        })
        ;

      for (const event of req.distraction_events) {
        await tx.insert(distractionEvents)
          .values({
            id: uid(),
            userId: userId,
            sessionId,
            timestamp: Date.parse(event.timestamp),
            durationSeconds: event.duration_seconds,
            appIdentifier: event.app_identifier ?? null,
            bypassed: event.bypassed === true,
            reason: event.reason ?? null,
            guessedSeconds: event.guessed_seconds ?? null,
            createdAt: now,
          })
          ;
      }

      // Inside the transaction: the grown companion and the session that
      // caused it must land together or not at all.
      await tx.update(companions)
        .set(drained)
        .where(eq(companions.userId, userId))
        ;
    });

    return NextResponse.json<SessionResponse>({
      session_id: sessionId,
      pet_growth_delta: result.xpEarned,
      voided: pledge.voided,
      void_reason: pledge.reason,
      companion: drained,
    });
  } catch (error) {
    console.error("[sessions] failed to record session:", error);
    return NextResponse.json({ error: "failed to record session" }, { status: 500 });
  }
}
