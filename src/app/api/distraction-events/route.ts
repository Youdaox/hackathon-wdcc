import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { distractionEvents } from "@/lib/db/schema";
import { uid } from "@/lib/companion";
import { ensureCompanion } from "@/lib/api/users";
import { parseDistractionEventRequest } from "@/lib/api/contract";

/**
 * Logs a single distraction as it happens, mid-session.
 *
 * This exists alongside the `distraction_events` array on POST /api/sessions
 * because the two happen at different times: the client posts here the moment
 * the user answers the return check-in, while the session array is the record
 * written at session end.
 *
 * `session_id` is nullable — a live event is logged before the session row
 * exists. Those rows are backfilled by nothing right now; they are kept for
 * the "here's what pulled you away" recap, which reads by user and time range.
 */

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = parseDistractionEventRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const req = parsed.value;

  try {
    ensureCompanion(req.user_id);

    const id = uid();
    db.insert(distractionEvents)
      .values({
        id,
        userId: req.user_id,
        sessionId: req.session_id,
        timestamp: Date.parse(req.timestamp),
        durationSeconds: req.duration_seconds,
        appLabel: req.app_label,
        appIdentifier: req.app_identifier,
        bypassed: req.bypassed,
        reason: req.reason,
        guessedSeconds: req.guessed_seconds,
        createdAt: Date.now(),
      })
      .run();

    return NextResponse.json({ event_id: id });
  } catch (error) {
    console.error("[distraction-events] failed to log event:", error);
    return NextResponse.json({ error: "failed to log distraction event" }, { status: 500 });
  }
}
