import type { DistractionEvent as WebDistractionEvent } from "@/lib/types";
import { RULES } from "@/lib/companion";

/**
 * The wire contract the iOS client speaks.
 *
 * Two conversions live here, and both are load-bearing:
 *
 * 1. **Time.** The wire uses ISO8601 strings and `duration_seconds`; the whole
 *    internal model uses epoch milliseconds. Converting at the boundary keeps
 *    `applySession()` untouched.
 *
 * 2. **Distraction semantics.** The iOS app reports *the app being
 *    backgrounded*; the web app reports *the tab being hidden*. Same idea,
 *    different events. `toWebDistraction()` is the one place that reconciles
 *    them, so the growth rules only ever see one shape.
 *
 * Validation is hand-rolled to match `isValidQuestion` in `src/lib/recall.ts`
 * rather than pulling in a schema library for four endpoints.
 */

export type Platform = "ios" | "web";

/**
 * Why the user left, as reported by the return check-in.
 *
 * The consequences differ on purpose — the point is to tell a real
 * interruption apart from a drift, which duration alone cannot do.
 */
export type AwayReason = "emergency" | "task" | "distraction" | "ended";

export const AWAY_REASONS: AwayReason[] = ["emergency", "task", "distraction", "ended"];

/**
 * Whether a pledged session was broken, and why.
 *
 * A pledge is the only thing in the app with real stakes, so the rule is
 * deliberately narrow and legible: you break it by stopping short of the time
 * you promised, or by pushing past an intercept. Being pulled away and coming
 * back does *not* break it — that's what the check-in is for.
 *
 * Computed server-side so a client can't quietly forgive itself.
 */
export function evaluatePledge(
  committedMinutes: number,
  verifiedMinutes: number,
  events: WireDistractionEvent[],
): { voided: boolean; reason: "left-early" | "bypassed" | null } {
  if (committedMinutes <= 0) return { voided: false, reason: null };
  if (events.some((e) => e.bypassed === true)) return { voided: true, reason: "bypassed" };
  // A small tolerance: a pledge shouldn't fail because a tap landed a second
  // early on a timer the user can't control to the millisecond.
  if (verifiedMinutes + 0.5 < committedMinutes) {
    return { voided: true, reason: "left-early" };
  }
  return { voided: false, reason: null };
}

/** Only a self-reported distraction costs HP. */
export function isPenalisedReason(reason: AwayReason | null): boolean {
  return reason === "distraction";
}

export interface WireDistractionEvent {
  timestamp: string;
  duration_seconds: number;
  /** User-supplied app label from a Shortcuts intercept. Null otherwise. */
  app_label?: string | null;
  /** True when the user pushed past the intercept screen. */
  bypassed?: boolean;
  /** Null when the stretch was too short to ask about. */
  reason?: AwayReason | null;
  /** What the user guessed before seeing the real number. */
  guessed_seconds?: number | null;
}

export interface SessionRequest {
  user_id: string;
  start_time: string;
  end_time: string;
  verified_minutes: number;
  location_verified: boolean;
  location_name: string | null;
  platform: Platform;
  /** Minutes pledged up front, or 0 for an open-ended session. */
  committed_minutes?: number;
  /** Flat XP from a correct recall check. Never scaled by the location bonus. */
  bonus_xp?: number;
  distraction_events: WireDistractionEvent[];
}

export interface SessionResponse {
  session_id: string;
  pet_growth_delta: number;
  /** True when a pledge was broken and the session earned nothing. */
  voided: boolean;
  /** Why it was voided, for the UI to say something specific. */
  void_reason: "left-early" | "bypassed" | null;
}

export interface DistractionEventRequest {
  user_id: string;
  session_id: string | null;
  timestamp: string;
  duration_seconds: number;
  app_label: string | null;
  bypassed: boolean;
  reason: AwayReason | null;
  guessed_seconds: number | null;
}

/** Result of validating an untrusted body: either a value or a reason. */
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const PLATFORMS: Platform[] = ["ios", "web"];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** ISO8601 in, epoch ms out. Rejects anything Date can't parse. */
function parseIso(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : ms;
}

export function isoFrom(ms: number): string {
  return new Date(ms).toISOString();
}

function parseWireDistraction(raw: unknown, index: number): Parsed<WireDistractionEvent> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: `distraction_events[${index}] must be an object` };
  }
  const e = raw as Record<string, unknown>;

  const timestamp = parseIso(e.timestamp);
  if (timestamp === null) {
    return { ok: false, error: `distraction_events[${index}].timestamp must be ISO8601` };
  }
  if (!isFiniteNumber(e.duration_seconds) || e.duration_seconds < 0) {
    return {
      ok: false,
      error: `distraction_events[${index}].duration_seconds must be a number >= 0`,
    };
  }
  let appLabel: string | null = null;
  if (e.app_label !== undefined && e.app_label !== null) {
    if (typeof e.app_label !== "string") {
      return { ok: false, error: `distraction_events[${index}].app_label must be a string or null` };
    }
    // Free text straight from a user's Shortcut — clamp it so a pathological
    // label can't bloat a row or the recap UI.
    appLabel = e.app_label.slice(0, 60);
  }

  if (e.bypassed !== undefined && typeof e.bypassed !== "boolean") {
    return { ok: false, error: `distraction_events[${index}].bypassed must be a boolean` };
  }

  // Absent and null both mean "nobody was asked" — the normal case for a
  // stretch below the check-in threshold, not a client bug.
  let reason: AwayReason | null = null;
  if (e.reason !== undefined && e.reason !== null) {
    if (typeof e.reason !== "string" || !AWAY_REASONS.includes(e.reason as AwayReason)) {
      return {
        ok: false,
        error: `distraction_events[${index}].reason must be one of ${AWAY_REASONS.join(", ")}`,
      };
    }
    reason = e.reason as AwayReason;
  }

  let guessedSeconds: number | null = null;
  if (e.guessed_seconds !== undefined && e.guessed_seconds !== null) {
    if (!isFiniteNumber(e.guessed_seconds) || e.guessed_seconds < 0) {
      return {
        ok: false,
        error: `distraction_events[${index}].guessed_seconds must be a number >= 0`,
      };
    }
    guessedSeconds = e.guessed_seconds;
  }

  return {
    ok: true,
    value: {
      timestamp: isoFrom(timestamp),
      duration_seconds: e.duration_seconds,
      app_label: appLabel,
      bypassed: e.bypassed === true,
      reason,
      guessed_seconds: guessedSeconds,
    },
  };
}

export function parseSessionRequest(raw: unknown): Parsed<SessionRequest> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "body must be a JSON object" };
  }
  const b = raw as Record<string, unknown>;

  if (!isNonEmptyString(b.user_id)) {
    return { ok: false, error: "user_id is required" };
  }
  const startTime = parseIso(b.start_time);
  if (startTime === null) return { ok: false, error: "start_time must be ISO8601" };
  const endTime = parseIso(b.end_time);
  if (endTime === null) return { ok: false, error: "end_time must be ISO8601" };
  if (endTime < startTime) {
    return { ok: false, error: "end_time must not precede start_time" };
  }
  if (!isFiniteNumber(b.verified_minutes) || b.verified_minutes < 0) {
    return { ok: false, error: "verified_minutes must be a number >= 0" };
  }
  // A client can't have verified more focus than the session's wall-clock
  // length. This is the one bit of anti-cheat the server can do cheaply.
  const wallClockMinutes = (endTime - startTime) / 60_000;
  if (b.verified_minutes > wallClockMinutes + 1) {
    return {
      ok: false,
      error: "verified_minutes exceeds the session's wall-clock duration",
    };
  }
  if (typeof b.location_verified !== "boolean") {
    return { ok: false, error: "location_verified must be a boolean" };
  }
  const locationName =
    b.location_name === undefined || b.location_name === null
      ? null
      : typeof b.location_name === "string"
        ? b.location_name
        : undefined;
  if (locationName === undefined) {
    return { ok: false, error: "location_name must be a string or null" };
  }
  if (!isNonEmptyString(b.platform) || !PLATFORMS.includes(b.platform as Platform)) {
    return { ok: false, error: `platform must be one of ${PLATFORMS.join(", ")}` };
  }
  let committedMinutes = 0;
  if (b.committed_minutes !== undefined && b.committed_minutes !== null) {
    if (!isFiniteNumber(b.committed_minutes) || b.committed_minutes < 0) {
      return { ok: false, error: "committed_minutes must be a number >= 0" };
    }
    committedMinutes = b.committed_minutes;
  }
  let bonusXp = 0;
  if (b.bonus_xp !== undefined && b.bonus_xp !== null) {
    if (!isFiniteNumber(b.bonus_xp) || b.bonus_xp < 0 || b.bonus_xp > 100) {
      return { ok: false, error: "bonus_xp must be a number between 0 and 100" };
    }
    bonusXp = b.bonus_xp;
  }

  const rawEvents = b.distraction_events ?? [];
  if (!Array.isArray(rawEvents)) {
    return { ok: false, error: "distraction_events must be an array" };
  }
  const events: WireDistractionEvent[] = [];
  for (let i = 0; i < rawEvents.length; i++) {
    const parsed = parseWireDistraction(rawEvents[i], i);
    if (!parsed.ok) return parsed;
    events.push(parsed.value);
  }

  return {
    ok: true,
    value: {
      user_id: b.user_id,
      start_time: isoFrom(startTime),
      end_time: isoFrom(endTime),
      verified_minutes: b.verified_minutes,
      location_verified: b.location_verified,
      location_name: locationName,
      platform: b.platform as Platform,
      committed_minutes: committedMinutes,
      bonus_xp: bonusXp,
      distraction_events: events,
    },
  };
}

export function parseDistractionEventRequest(raw: unknown): Parsed<DistractionEventRequest> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "body must be a JSON object" };
  }
  const b = raw as Record<string, unknown>;

  if (!isNonEmptyString(b.user_id)) return { ok: false, error: "user_id is required" };

  const event = parseWireDistraction(
    {
      timestamp: b.timestamp,
      duration_seconds: b.duration_seconds,
      app_label: b.app_label ?? null,
      bypassed: b.bypassed ?? false,
      reason: b.reason ?? null,
      guessed_seconds: b.guessed_seconds ?? null,
    },
    0,
  );
  if (!event.ok) return { ok: false, error: event.error.replace("distraction_events[0].", "") };

  const sessionId =
    b.session_id === undefined || b.session_id === null
      ? null
      : typeof b.session_id === "string"
        ? b.session_id
        : undefined;
  if (sessionId === undefined) {
    return { ok: false, error: "session_id must be a string or null" };
  }

  return {
    ok: true,
    value: {
      user_id: b.user_id,
      session_id: sessionId,
      timestamp: event.value.timestamp,
      duration_seconds: event.value.duration_seconds,
      app_label: event.value.app_label ?? null,
      bypassed: event.value.bypassed === true,
      reason: event.value.reason ?? null,
      guessed_seconds: event.value.guessed_seconds ?? null,
    },
  };
}

/**
 * Maps a wire distraction onto the shape the growth rules expect.
 *
 * The `penalized` rule is a game-balance decision, not a mechanical one:
 *
 * - **A stated reason always wins.** Someone who stepped out for an emergency
 *   should not lose HP for it, and the whole point of asking is that the
 *   answer changes the outcome — otherwise it's a guilt prompt, not a
 *   diagnostic.
 * - **Unexplained stretches fall back to duration**, forgiving anything inside
 *   the grace window so an accidental app-switch isn't punished.
 */
export function toWebDistraction(event: WireDistractionEvent): WebDistractionEvent {
  const durationMs = event.duration_seconds * 1000;
  const reason = event.reason ?? null;

  // A stated reason overrides everything. Someone who stepped out for an
  // emergency should not lose HP for it, and the whole point of asking is that
  // the answer changes the outcome — otherwise it's a guilt prompt, not a
  // diagnostic.
  const penalized = reason !== null ? isPenalisedReason(reason) : durationMs >= RULES.graceMs;

  return { startedAt: Date.parse(event.timestamp), durationMs, penalized };
}
