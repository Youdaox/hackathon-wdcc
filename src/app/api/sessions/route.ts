import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { companions, distractionEvents, sessions, studySpots } from "@/lib/db/schema";
import { applySession, uid } from "@/lib/companion";
import { ensureCompanion } from "@/lib/api/users";
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

  try {
    const companion = ensureCompanion(req.user_id);

    // The client reports *where* it was; the server decides what that is
    // worth. A device claiming "General Library" cannot invent a multiplier.
    let xpMultiplier = 1;
    if (req.location_verified && req.location_name) {
      const spot = db
        .select()
        .from(studySpots)
        .where(eq(studySpots.name, req.location_name))
        .get();
      if (spot) xpMultiplier = spot.multiplier;
    }

    // A broken pledge forfeits the XP but keeps the HP consequences: the
    // session still happened, it just earned nothing. Zeroing focused time
    // rather than the result means levels can't creep up on a forfeit.
    const pledge = evaluatePledge(
      req.committed_minutes ?? 0,
      req.verified_minutes,
      req.distraction_events,
    );

    const distractions = req.distraction_events.map(toWebDistraction);
    const result = applySession(
      companion,
      {
        focusedMs: pledge.voided ? 0 : req.verified_minutes * 60_000,
        distractions,
      },
      xpMultiplier,
    );

    const sessionId = uid();
    const now = Date.now();

    // One transaction: a session that grows the pet but loses its own
    // distraction rows would make the growth impossible to explain afterward.
    db.transaction((tx) => {
      tx.insert(sessions)
        .values({
          id: sessionId,
          userId: req.user_id,
          startTime: Date.parse(req.start_time),
          endTime: Date.parse(req.end_time),
          verifiedMinutes: req.verified_minutes,
          locationVerified: req.location_verified,
          locationName: req.location_name,
          platform: req.platform,
          xpEarned: result.xpEarned,
          hpDelta: result.hpDelta,
          xpMultiplier,
          committedMinutes: req.committed_minutes ?? 0,
          voided: pledge.voided,
          createdAt: now,
        })
        .run();

      for (const event of req.distraction_events) {
        tx.insert(distractionEvents)
          .values({
            id: uid(),
            userId: req.user_id,
            sessionId,
            timestamp: Date.parse(event.timestamp),
            durationSeconds: event.duration_seconds,
            appLabel: event.app_label ?? null,
            bypassed: event.bypassed === true,
            reason: event.reason ?? null,
            guessedSeconds: event.guessed_seconds ?? null,
            createdAt: now,
          })
          .run();
      }

      // Inside the transaction: the grown companion and the session that
      // caused it must land together or not at all.
      tx.update(companions)
        .set(result.companion)
        .where(eq(companions.userId, req.user_id))
        .run();
    });

    return NextResponse.json<SessionResponse>({
      session_id: sessionId,
      pet_growth_delta: result.xpEarned,
      voided: pledge.voided,
      void_reason: pledge.reason,
    });
  } catch (error) {
    console.error("[sessions] failed to record session:", error);
    return NextResponse.json({ error: "failed to record session" }, { status: 500 });
  }
}
