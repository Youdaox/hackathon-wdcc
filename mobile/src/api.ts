import { Platform } from "react-native";
import { API_BASE_URL, USER_ID } from "./config";

/**
 * The server's contract accepts exactly android | ios | web, which is what
 * Platform.OS reports on every target Expo Go runs on.
 */
const PLATFORM = Platform.OS === "android" ? "android" : Platform.OS === "web" ? "web" : "ios";

/**
 * Client for the Incline sync API.
 *
 * Mirrors the wire contract in `src/lib/api/contract.ts` on the server: ISO8601
 * timestamps, `duration_seconds`, snake_case. The conversion from the app's
 * internal milliseconds happens here, at the boundary, so the rest of the app
 * only ever deals in numbers.
 */

export interface Companion {
  name: string;
  species: string;
  level: number;
  xp: number;
  xp_needed: number;
  hp: number;
  mood: "happy" | "neutral" | "sad" | "sick";
  total_focused_ms: number;
  last_session_at: string | null;
}

export interface StudySpot {
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  multiplier: number;
}

export interface DistractionRecord {
  startedAt: number;
  durationMs: number;
}

export interface SessionResult {
  session_id: string;
  pet_growth_delta: number;
}

const TIMEOUT_MS = 8_000;

/**
 * fetch with a timeout. Without one, a phone on campus wifi that can't reach
 * the laptop hangs on a spinner instead of failing and letting the session end.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.error ?? `request failed (${response.status})`);
    }
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

export function fetchCompanion(): Promise<Companion> {
  return request<Companion>(`/api/companion?user_id=${encodeURIComponent(USER_ID)}`);
}

export async function fetchStudySpots(): Promise<StudySpot[]> {
  const body = await request<{ spots: StudySpot[] }>(
    `/api/study-spots?user_id=${encodeURIComponent(USER_ID)}`,
  );
  return body.spots;
}

/**
 * Posts a finished session. The server computes growth — this returns what the
 * pet actually gained, which is not something the app tries to predict.
 *
 * `app_identifier` is always null and `bypassed` always false: Expo Go can see
 * that the user left Incline, but never where they went, and has no block
 * screen to bypass. The server's penalty rule accounts for exactly this case.
 */
export function postSession(params: {
  startedAt: number;
  endedAt: number;
  focusedMs: number;
  locationName: string | null;
  distractions: DistractionRecord[];
}): Promise<SessionResult> {
  return request<SessionResult>("/api/sessions", {
    method: "POST",
    body: JSON.stringify({
      user_id: USER_ID,
      start_time: new Date(params.startedAt).toISOString(),
      end_time: new Date(params.endedAt).toISOString(),
      verified_minutes: params.focusedMs / 60_000,
      location_verified: params.locationName !== null,
      location_name: params.locationName,
      platform: PLATFORM,
      distraction_events: params.distractions.map((d) => ({
        app_identifier: null,
        timestamp: new Date(d.startedAt).toISOString(),
        duration_seconds: d.durationMs / 1000,
        bypassed: false,
      })),
    }),
  });
}
