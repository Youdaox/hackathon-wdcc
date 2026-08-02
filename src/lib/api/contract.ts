import type { DistractionEvent as WebDistractionEvent } from "@/lib/types";
import type { Companion } from "@/lib/types";
import { RULES } from "@/lib/companion";

/**
 * The wire contract the Android and iOS clients speak.
 *
 * Two conversions live here, and both are load-bearing:
 *
 * 1. **Time.** The wire uses ISO8601 strings and `duration_seconds`; the whole
 *    internal model uses epoch milliseconds. Converting at the boundary keeps
 *    `applySession()` untouched.
 *
 * 2. **Distraction semantics.** The mobile clients report a *restricted app
 *    being opened*; the web app reports *the tab being hidden*. Same word,
 *    different events. `toWebDistraction()` is the one place that reconciles
 *    them, so the growth rules only ever see one shape.
 *
 * Validation is hand-rolled to match `isValidQuestion` in `src/lib/recall.ts`
 * rather than pulling in a schema library for four endpoints.
 */

export type Platform = "android" | "ios" | "web";

export interface WireDistractionEvent {
  /** Android package name. Null on iOS — Apple never tells us which app. */
  app_identifier: string | null;
  timestamp: string;
  duration_seconds: number;
  bypassed: boolean;
}

export interface SessionRequest {
  user_id: string;
  start_time: string;
  end_time: string;
  verified_minutes: number;
  location_verified: boolean;
  location_name: string | null;
  platform: Platform;
  distraction_events: WireDistractionEvent[];
}

export interface SessionResponse {
  session_id: string;
  pet_growth_delta: number;
  companion: Companion;
}

export interface DistractionEventRequest {
  user_id: string;
  session_id: string | null;
  app_identifier: string | null;
  timestamp: string;
  duration_seconds: number;
  bypassed: boolean;
}

/** Result of validating an untrusted body: either a value or a reason. */
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const PLATFORMS: Platform[] = ["android", "ios", "web"];

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
  if (typeof e.bypassed !== "boolean") {
    return { ok: false, error: `distraction_events[${index}].bypassed must be a boolean` };
  }
  // Absent and explicitly null both mean "not knowable" — that's the normal
  // iOS case, not a client bug.
  const appIdentifier =
    e.app_identifier === undefined || e.app_identifier === null
      ? null
      : typeof e.app_identifier === "string"
        ? e.app_identifier
        : undefined;
  if (appIdentifier === undefined) {
    return {
      ok: false,
      error: `distraction_events[${index}].app_identifier must be a string or null`,
    };
  }

  return {
    ok: true,
    value: {
      app_identifier: appIdentifier,
      timestamp: isoFrom(timestamp),
      duration_seconds: e.duration_seconds,
      bypassed: e.bypassed,
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
      app_identifier: b.app_identifier ?? null,
      timestamp: b.timestamp,
      duration_seconds: b.duration_seconds,
      bypassed: b.bypassed,
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
      app_identifier: event.value.app_identifier,
      timestamp: event.value.timestamp,
      duration_seconds: event.value.duration_seconds,
      bypassed: event.value.bypassed,
    },
  };
}

/**
 * Maps a mobile distraction onto the shape the growth rules expect.
 *
 * The `penalized` rule is a game-balance decision, not a mechanical one:
 *
 * - **Bypassing always counts.** You saw the block screen and pushed through
 *   anyway. That is the clearest possible signal of a broken focus session.
 * - **Long opens count even without a bypass.** Without this, iOS would be
 *   strictly easier than Android — Apple owns the shield screen, so an iOS
 *   user *cannot* press bypass and would never be penalised at all.
 * - **Short bounces are forgiven**, matching the web app's grace window for
 *   accidental tab switches.
 */
export function toWebDistraction(event: WireDistractionEvent): WebDistractionEvent {
  const durationMs = event.duration_seconds * 1000;
  return {
    startedAt: Date.parse(event.timestamp),
    durationMs,
    penalized: event.bypassed || durationMs >= RULES.graceMs,
  };
}
